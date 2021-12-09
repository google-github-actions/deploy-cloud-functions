import { expect } from 'chai';
import os from 'os';
import * as fs from 'fs';
import crypto from 'crypto';
import 'mocha';
import * as path from 'path';
import {
  errorMessage,
  parseDuration,
  parseKVFile,
  parseKVString,
  parseKVStringAndFile,
  parseKVYAML,
  parseServiceAccountKeyJSON,
  presence,
  zipDir,
} from '../src/util';
import StreamZip from 'node-stream-zip';

const name = `zip-${Math.round(Math.random() * 100000)}`;

describe('Util', () => {
  describe('#parseServiceAccountKeyJSON', () => {
    const cases = [
      {
        name: 'empty string',
        input: '',
        error: 'Missing service account key JSON',
      },
      {
        name: 'empty string trim',
        input: '   ',
        error: 'Missing service account key JSON',
      },
      {
        name: 'invalid json',
        input: `{"x}`,
        error: 'Failed to parse service account key JSON credentials',
      },
      {
        name: 'parses',
        input: `{"client_email": "foo@bar.com"}`,
        expected: {
          client_email: 'foo@bar.com',
        },
      },
      {
        name: 'base64 decodes',
        input: Buffer.from(`{"client_email": "foo@bar.com"}`).toString(
          'base64',
        ),
        expected: {
          client_email: 'foo@bar.com',
        },
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, () => {
        if (tc.expected) {
          expect(parseServiceAccountKeyJSON(tc.input)).to.eql(tc.expected);
        } else if (tc.error) {
          expect(() => {
            parseServiceAccountKeyJSON(tc.input);
          }).to.throw(tc.error);
        }
      });
    });
  });

  describe('#parseKVString', () => {
    const cases = [
      {
        name: 'empty string',
        input: '',
        expected: {},
      },
      {
        name: 'single value',
        input: 'FOO=bar',
        expected: { FOO: 'bar' },
      },
      {
        name: 'multi value',
        input: 'FOO=bar,ZIP=zap',
        expected: { FOO: 'bar', ZIP: 'zap' },
      },
      {
        name: 'trims',
        input: '  FOO= bar, ZIP=zap ',
        expected: { FOO: 'bar', ZIP: 'zap' },
      },
      {
        name: 'escaped comma key',
        input: 'FOO\\,BAR=baz,ZIP=zap',
        expected: { 'FOO,BAR': 'baz', 'ZIP': 'zap' },
      },
      {
        name: 'double escaped comma key',
        input: 'FOO\\\\,BAR=baz,ZIP=zap',
        expected: { 'FOO\\,BAR': 'baz', 'ZIP': 'zap' },
      },
      {
        name: 'escaped comma value',
        input: 'FOO=bar\\,baz,ZIP=zap',
        expected: { FOO: 'bar,baz', ZIP: 'zap' },
      },
      {
        name: 'double escaped comma value',
        input: 'FOO=bar\\\\,baz,ZIP=zap',
        expected: { FOO: 'bar\\,baz', ZIP: 'zap' },
      },
      {
        name: 'missing key',
        input: '=bar',
        error: 'Failed to parse',
      },
      {
        name: 'missing value',
        input: 'FOO=',
        error: 'Failed to parse',
      },
      {
        name: 'no equal',
        input: 'FOO',
        error: 'Failed to parse',
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, () => {
        if (tc.expected) {
          expect(parseKVString(tc.input)).to.eql(tc.expected);
        } else if (tc.error) {
          expect(() => {
            parseKVString(tc.input);
          }).to.throw(tc.error);
        }
      });
    });
  });

  describe('#parseKVYAML', () => {
    const cases = [
      {
        name: 'empty string',
        input: '',
        expected: {},
      },
      {
        name: 'single value',
        input: `
          FOO: 'bar'
        `,
        expected: { FOO: 'bar' },
      },
      {
        name: 'multi value',
        input: `
          FOO: 'bar'
          ZIP: 'zap'
        `,
        expected: { FOO: 'bar', ZIP: 'zap' },
      },
      {
        name: 'trims',
        input: `
          FOO: 'bar  '
          ZIP : '  zap'
        `,
        expected: { FOO: 'bar', ZIP: 'zap' },
      },
      {
        name: 'not string value',
        input: `
          FOO:
            BAR: 'baz'
        `,
        error: 'must contain only KEY: VALUE strings',
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, () => {
        if (tc.expected) {
          expect(parseKVYAML(tc.input)).to.eql(tc.expected);
        } else if (tc.error) {
          expect(() => {
            parseKVYAML(tc.input);
          }).to.throw(tc.error);
        }
      });
    });
  });

  describe('#parseKVFile', () => {
    it('reads the file as yaml', () => {
      const randomName = crypto.randomBytes(12).toString('hex');
      const filepath = path.join(os.tmpdir(), randomName);
      fs.writeFileSync(filepath, `FOO: 'bar'`);

      const result = parseKVFile(filepath);
      expect(result).to.eql({ FOO: 'bar' });
    });

    it('throws an error when the file does not exist', () => {
      try {
        parseKVFile('/path/that/definitely/does/not/exist');
        throw new Error(`error should have been thrown`);
      } catch (err) {
        expect(`${err}`).to.include('Failed to read file');
      }
    });
  });

  describe('#parseKVStringAndFile', () => {
    it('handles null kvString and kvFilePath', () => {
      const kvString = '';
      const kvFile = '';

      const result = parseKVStringAndFile(kvString, kvFile);
      expect(result).to.eql({});
    });

    it('merges kvString and kvFile', () => {
      const kvString = `FOO=other foo`;

      const randomName = crypto.randomBytes(12).toString('hex');
      const kvFile = path.join(os.tmpdir(), randomName);
      fs.writeFileSync(
        kvFile,
        `
        FOO: 'bar'
        ZIP: 'zap'
      `,
      );

      const result = parseKVStringAndFile(kvString, kvFile);
      expect(result).to.eql({ FOO: 'other foo', ZIP: 'zap' });
    });
  });

  describe('#presence', () => {
    const cases = [
      {
        name: 'null',
        input: null,
        expected: undefined,
      },
      {
        name: 'undefined',
        input: undefined,
        expected: undefined,
      },
      {
        name: 'empty string',
        input: '',
        expected: undefined,
      },
      {
        name: 'string spaces',
        input: '   ',
        expected: undefined,
      },
      {
        name: 'value',
        input: 'value',
        expected: 'value',
      },
      {
        name: 'trims',
        input: '  value  ',
        expected: 'value',
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, () => {
        expect(presence(tc.input)).to.eql(tc.expected);
      });
    });
  });

  describe('#errorMessage', () => {
    const cases = [
      {
        name: 'null',
        input: null,
        expected: '',
      },
      {
        name: 'undefined',
        input: undefined,
        expected: '',
      },
      {
        name: 'empty string',
        input: '',
        expected: '',
      },
      {
        name: 'trims',
        input: '   ',
        expected: '',
      },
      {
        name: 'single character',
        input: 'a',
        expected: 'a',
      },
      {
        name: 'single character error',
        input: new Error('a'),
        expected: 'a',
      },
      {
        name: 'lowercase first',
        input: new Error('Failed with'),
        expected: 'failed with',
      },
      {
        name: 'error',
        input: new Error('foobar'),
        expected: 'foobar',
      },
      {
        name: 'error prefix',
        input: new Error('Error: failed'),
        expected: 'failed',
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, () => {
        expect(errorMessage(tc.input)).to.eql(tc.expected);
      });
    });
  });

  describe('#parseDuration', () => {
    const cases = [
      {
        name: 'empty string',
        input: '',
        expected: 0,
      },
      {
        name: 'unitless',
        input: '149585',
        expected: 149585,
      },
      {
        name: 'with commas',
        input: '149,585',
        expected: 149585,
      },
      {
        name: 'suffix seconds',
        input: '149585s',
        expected: 149585,
      },
      {
        name: 'suffix minutes',
        input: '25m',
        expected: 1500,
      },
      {
        name: 'suffix hours',
        input: '12h',
        expected: 43200,
      },
      {
        name: 'suffix hours minutes seconds',
        input: '12h10m55s',
        expected: 43855,
      },
      {
        name: 'commas and spaces',
        input: '12h, 10m 55s',
        expected: 43855,
      },
      {
        name: 'invalid',
        input: '12h blueberries',
        error: 'Unsupported character "b" at position 4',
      },
    ];

    cases.forEach((tc) => {
      it(tc.name, async () => {
        if (tc.expected) {
          expect(parseDuration(tc.input)).to.eq(tc.expected);
        } else if (tc.error) {
          expect(() => {
            parseDuration(tc.input);
          }).to.throw(tc.error);
        }
      });
    });
  });
});

describe('#Zip', () => {
  const cases = [
    {
      name: 'throws an error if sourceDir does not exist',
      zipDir: '/not/a/real/path',
      error: 'Unable to find',
    },
    {
      name: 'creates a zipfile with correct files without gcloudignore',
      zipDir: 'tests/test-node-func',
      expectedFiles: ['.dotfile', 'index.js', 'package.json'],
      error: 'Unable to find',
    },
    {
      name: 'creates a zipfile with correct files with simple gcloudignore',
      zipDir: 'tests/test-func-ignore',
      expectedFiles: ['index.js', 'package.json'],
      error: 'Unable to find',
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
      error: 'Unable to find',
    },
  ];

  cases.forEach((tc) => {
    it(tc.name, async () => {
      if (tc.expectedFiles) {
        const zf = await zipDir(tc.zipDir, path.posix.join(os.tmpdir(), name));
        const filesInsideZip = await getFilesInZip(zf);
        expect(filesInsideZip).eql(tc.expectedFiles);
        filesInsideZip.forEach((f) => expect(tc.expectedFiles).to.include(f));
      } else if (tc.error) {
        try {
          await zipDir(tc.zipDir, path.posix.join(os.tmpdir(), name));
          throw new Error(`Should have thrown err: ${tc.error}`);
        } catch (err) {
          expect(`${err}`).to.contain(tc.error);
        }
      }
    });
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
