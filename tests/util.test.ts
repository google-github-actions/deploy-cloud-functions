/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test } from 'node:test';
import assert from 'node:assert';

import StreamZip from 'node-stream-zip';
import { assertMembers, randomFilepath } from '@google-github-actions/actions-utils';

import { stringToInt, toEnum, zipDir } from '../src/util';

test('#zipDir', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'throws an error if sourceDir does not exist',
      zipDir: '/not/a/real/path',
      expectedFiles: [],
      error: 'Unable to find',
    },
    {
      name: 'creates a zipfile with correct files without gcloudignore',
      zipDir: 'tests/test-node-func',
      expectedFiles: ['.dotfile', 'index.js', 'package.json'],
    },
    {
      name: 'creates a zipfile with correct files with simple gcloudignore',
      zipDir: 'tests/test-func-ignore',
      expectedFiles: ['index.js', 'package.json'],
    },
    {
      name: 'creates a zipfile with correct files with simple gcloudignore',
      zipDir: 'tests/test-func-ignore-node',
      expectedFiles: [
        '.gcloudignore',
        'foo/data.txt',
        'index.js',
        'notIgnored.txt',
        'package.json',
      ],
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.error) {
        await assert.rejects(async () => {
          await zipDir(tc.zipDir, randomFilepath());
        }, new RegExp(tc.error));
      } else {
        const zf = await zipDir(tc.zipDir, randomFilepath());
        const filesInsideZip = await getFilesInZip(zf);
        assertMembers(filesInsideZip, tc.expectedFiles);
      }
    });
  }
});

test('#toEnum', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'empty',
      str: '',
      exp: '',
    },
    {
      name: 'uppers',
      str: 'foo',
      exp: 'FOO',
    },
    {
      name: 'spaces',
      str: 'foo bar',
      exp: 'FOO_BAR',
    },
    {
      name: 'dashes',
      str: 'foo-bar',
      exp: 'FOO_BAR',
    },
    {
      name: 'multiple spaces',
      str: 'foo bar   baz',
      exp: 'FOO_BAR_BAZ',
    },
    {
      name: 'multiple dashes',
      str: 'foo-bar--baz',
      exp: 'FOO_BAR_BAZ',
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, () => {
      const actual = toEnum(tc.str);
      assert.deepStrictEqual(actual, tc.exp);
    });
  }
});

test('#stringToInt', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'empty',
      input: '',
      expected: undefined,
    },
    {
      name: 'spaces',
      input: ' ',
      expected: undefined,
    },
    {
      name: 'digit',
      input: '1',
      expected: 1,
    },
    {
      name: 'multi-digit',
      input: '123',
      expected: 123,
    },
    {
      name: 'suffix',
      input: '100MB',
      expected: 100,
    },
    {
      name: 'comma',
      input: '1,000',
      expected: 1000,
    },
    {
      name: 'NaN',
      input: 'this is definitely not a number',
      error: 'input "this is definitely not a number" is not a number',
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.error) {
        assert.throws(() => {
          stringToInt(tc.input);
        }, new RegExp(tc.error));
      } else {
        const actual = stringToInt(tc.input);
        assert.deepStrictEqual(actual, tc.expected);
      }
    });
  }
});

/**
 *
 * @param zipFilePath path to zipfile
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
