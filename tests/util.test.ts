import { expect } from 'chai';
import os from 'os';
import * as fs from 'fs';
import 'mocha';
import * as path from 'path';
import { zipDir, parseKVPairs, parseEnvVarsFile } from '../src/util';
import StreamZip from 'node-stream-zip';

const testDirNoIgnore = 'tests/test-node-func';
const testDirSimpleIgnore = 'tests/test-func-ignore';
const testDirNodeIgnore = 'tests/test-func-ignore-node';
const name = `zip-${Math.round(Math.random() * 100000)}`;
describe('Zip', function () {
  it('creates a zipfile with correct files without gcloudignore', async function () {
    const zf = await zipDir(
      testDirNoIgnore,
      path.posix.join(os.tmpdir(), name),
    );
    const filesInsideZip = await getFilesInZip(zf);
    const expectedFiles = getNonIgnoredFiles(testDirNoIgnore, testDirNoIgnore);

    expect(await filesInsideZip.length).equal(expectedFiles.length);
    filesInsideZip.forEach((f) => expect(expectedFiles).to.include(f));
  });

  it('creates a zipfile with correct files with simple gcloudignore', async function () {
    const zf = await zipDir(
      testDirSimpleIgnore,
      path.posix.join(os.tmpdir(), name),
    );
    const filesInsideZip = await getFilesInZip(zf);
    const expectedFiles = getNonIgnoredFiles(
      testDirSimpleIgnore,
      testDirSimpleIgnore,
      new Set(['ignore.txt', '.gcloudignore']),
    );

    expect(await filesInsideZip.length).equal(expectedFiles.length);
    filesInsideZip.forEach((f) => expect(expectedFiles).to.include(f));
  });

  it('creates a zipfile with correct files with dir gcloudignore', async function () {
    const zf = await zipDir(
      testDirNodeIgnore,
      path.posix.join(os.tmpdir(), name),
    );
    const filesInsideZip = await getFilesInZip(zf);
    const expectedFiles = getNonIgnoredFiles(
      testDirNodeIgnore,
      testDirNodeIgnore,
      new Set(['bar/bar.txt', 'bar/baz/baz.txt']),
    );

    expect(await filesInsideZip.length).equal(expectedFiles.length);
    filesInsideZip.forEach((f) => expect(expectedFiles).to.include(f));
  });
});

describe('Parse KV pairs', function () {
  it('parse single unquoted envVar', async function () {
    const envVar = 'KEY1=VALUE1';
    const pairs = parseKVPairs(envVar);
    expect(pairs).deep.equal({ KEY1: 'VALUE1' });
  });
  it('parse single quoted envVar', async function () {
    const envVar = 'KEY1="VALUE1"';
    const pairs = parseKVPairs(envVar);
    expect(pairs).deep.equal({ KEY1: 'VALUE1' });
  });
  it('parse multiple unquoted envVars', async function () {
    const envVars = 'KEY1=VALUE1,KEY2=VALUE2';
    const pairs = parseKVPairs(envVars);
    expect(pairs).deep.equal({ KEY1: 'VALUE1', KEY2: 'VALUE2' });
  });
  it('parse multiple quoted envVars', async function () {
    const envVars = 'KEY1="VALUE1",KEY2="VALUE2"';
    const pairs = parseKVPairs(envVars);
    expect(pairs).deep.equal({ KEY1: 'VALUE1', KEY2: 'VALUE2' });
  });
  it('parse mix of quoted and unquoted envVars', async function () {
    const envVars = 'KEY1=VALUE1,KEY2="VALUE2"';
    const pairs = parseKVPairs(envVars);
    expect(pairs).deep.equal({ KEY1: 'VALUE1', KEY2: 'VALUE2' });
  });
  it('parse envVars with multiple = characters', async function () {
    const envVars = 'KEY1=VALUE=1,KEY2=VALUE=2';
    const pairs = parseKVPairs(envVars);
    expect(pairs).deep.equal({ KEY1: 'VALUE=1', KEY2: 'VALUE=2' });
  });
  it('throws an error if envVars is malformed', async function () {
    const envVars = 'KEY1,VALUE1';
    expect(function () {
      parseKVPairs(envVars);
    }).to.throw(
      'The expected data format should be "KEY1=VALUE1", got "KEY1" while parsing "KEY1,VALUE1"',
    );
  });
  it('throws an error if envVars are not quoted correctly', async function () {
    const envVars = 'KEY1="VALUE1.1,VALUE1.2,KEY2="VALUE2"';
    expect(function () {
      parseKVPairs(envVars);
    }).to.throw(
      `The expected data format should be "KEY1=VALUE1", got "VALUE1.2" while parsing "KEY1="VALUE1.1,VALUE1.2,KEY2="VALUE2""`,
    );
  });
});

describe('Parse envVars file', function () {
  it('creates a http function with envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.good.yaml';
    const pairs = parseEnvVarsFile(envVarsFile);
    expect(pairs).to.deep.equal({
      KEY1: 'VALUE1',
      KEY2: 'VALUE2',
      JSONKEY: '{"bar":"baz"}',
    });
  });

  it('throws an error with bad envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.bad.yaml';
    expect(function () {
      parseEnvVarsFile(envVarsFile);
    }).to.throw(
      'env_vars_file yaml must contain only key/value pair of strings. Error parsing key KEY2 of type string with value VALUE2,VALUE3 of type object',
    );
  });

  it('throws an error with nonexistent envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.nonexistent.yaml';
    expect(function () {
      parseEnvVarsFile(envVarsFile);
    }).to.throw(
      "ENOENT: no such file or directory, open 'tests/env-var-files/test.nonexistent.yaml",
    );
  });
});

/**
 *
 * @param zipFile path to zipfile
 * @returns list of files within zipfile
 */
async function getFilesInZip(zipFilePath: string): Promise<string[]> {
  const uzf = new StreamZip.async({ file: zipFilePath });
  const zipEntries = await uzf.entries();
  const filesInsideZip: string[] = [];
  for (const k in zipEntries) {
    if (zipEntries[k].isFile) {
      filesInsideZip.push(zipEntries[k].name);
    }
  }
  return filesInsideZip;
}

function getNonIgnoredFiles(
  parentDir: string,
  directory: string,
  ignore: Set<string> = new Set(),
  fileList: string[] = [],
): string[] {
  const items = fs.readdirSync(directory);
  for (const item of items) {
    const stat = fs.statSync(path.posix.join(directory, item));
    if (stat.isDirectory())
      fileList = getNonIgnoredFiles(
        parentDir,
        path.posix.join(directory, item),
        ignore,
        fileList,
      );
    else {
      const fPath = path.posix.relative(
        parentDir,
        path.posix.join(directory, item),
      );
      if (!ignore.has(fPath)) fileList.push(fPath);
    }
  }
  return fileList;
}
