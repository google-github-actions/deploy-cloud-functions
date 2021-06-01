import { expect } from 'chai';
import os from 'os';
import * as fs from 'fs';
import 'mocha';
import { join, relative } from 'path';
import { zipDir } from '../src/util';
import StreamZip from 'node-stream-zip';

const testDirNoIgnore = 'tests/test-node-func';
const testDirSimpleIgnore = 'tests/test-func-ignore';
const testDirNodeIgnore = 'tests/test-func-ignore-node';
const name = `zip-${Math.round(Math.random() * 100000)}`;
describe('Zip', function () {
  it('creates a zipfile with correct files without gcloudignore', async function () {
    const zf = await zipDir(testDirNoIgnore, join(os.tmpdir(), name));
    const uzf = new StreamZip.async({ file: zf });
    const filesInsideZip = await uzf.entries();
    const expectedFiles = getNonIgnoredFiles(testDirNoIgnore, testDirNoIgnore);
    expect(await uzf.entriesCount).equal(expectedFiles.length);
    for (const entry of Object.values(filesInsideZip)) {
      expect(expectedFiles).to.be.include(entry.name);
    }
  });

  it('creates a zipfile with correct files with simple gcloudignore', async function () {
    const zf = await zipDir(testDirSimpleIgnore, join(os.tmpdir(), name));
    const uzf = new StreamZip.async({ file: zf });
    const filesInsideZip = await uzf.entries();
    const expectedFiles = getNonIgnoredFiles(
      testDirSimpleIgnore,
      testDirSimpleIgnore,
      new Set(['ignore.txt', '.gcloudignore']),
    );
    expect(await uzf.entriesCount).equal(expectedFiles.length);
    for (const entry of Object.values(filesInsideZip)) {
      expect(expectedFiles).to.be.include(entry.name);
    }
  });

  it('creates a zipfile with correct files with dir gcloudignore', async function () {
    const zf = await zipDir(testDirNodeIgnore, join(os.tmpdir(), name));
    const uzf = new StreamZip.async({ file: zf });
    const filesInsideZip = await uzf.entries();
    const expectedFiles = getNonIgnoredFiles(
      testDirNodeIgnore,
      testDirNodeIgnore,
      new Set([
        'node_modules/foo/foo.txt',
        'node_modules/bar/bar.txt',
        '.gcloudignore',
      ]),
    );
    expect(await uzf.entriesCount).equal(expectedFiles.length);
    for (const entry of Object.values(filesInsideZip)) {
      expect(expectedFiles).to.be.include(entry.name);
    }
  });
});

function getNonIgnoredFiles(
  parentDir: string,
  directory: string,
  ignore: Set<string> = new Set(),
  fileList: string[] = [],
): string[] {
  const items = fs.readdirSync(directory);
  for (const item of items) {
    const stat = fs.statSync(join(directory, item));
    if (stat.isDirectory())
      fileList = getNonIgnoredFiles(
        parentDir,
        join(directory, item),
        ignore,
        fileList,
      );
    else {
      const fPath = relative(parentDir, join(directory, item));
      if (!ignore.has(fPath)) fileList.push(fPath);
    }
  }
  return fileList;
}
