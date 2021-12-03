import { expect } from 'chai';
import os from 'os';
import * as fs from 'fs';
import 'mocha';
import * as path from 'path';
import { zipDir } from '../src/util';
import StreamZip from 'node-stream-zip';

const testDirNoIgnore = 'tests/test-node-func';
const testDirSimpleIgnore = 'tests/test-func-ignore';
const testDirNodeIgnore = 'tests/test-func-ignore-node';
const name = `zip-${Math.round(Math.random() * 100000)}`;
describe('Zip', function () {
  it('raises an error if sourceDir does not exist', async function () {
    try {
      await zipDir('/not/a/real/path', path.posix.join(os.tmpdir(), name));
      throw new Error('Should have throw error');
    } catch (err) {
      const msg = (err && err.message) || '';
      if (!msg.includes('Unable to find')) {
        throw err;
      }
    }
  });

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
