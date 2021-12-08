/*
 * Copyright 2020 Google LLC
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

import fs from 'fs';
import * as Archiver from 'archiver';
import * as path from 'path';
import ignore from 'ignore';
import YAML from 'yaml';

import { ExternalAccountClientOptions } from 'google-auth-library';

/**
 * Zip a directory.
 *
 * @param dirPath Directory to zip.
 * @returns filepath of the created zip file.
 */
export function zipDir(dirPath: string, outputPath: string): Promise<string> {
  // Check dirpath
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Unable to find ${dirPath}`);
  }

  return new Promise((resolve, reject) => {
    // Create output file stream
    const output = fs.createWriteStream(outputPath);

    // Initialize archive
    const archive = Archiver.create('zip', { zlib: { level: 7 } });
    archive.on('warning', (err: Archiver.ArchiverError) => {
      reject(err);
    });
    archive.on('error', (err: Archiver.ArchiverError) => {
      reject(err);
    });
    output.on('finish', () => {
      resolve(outputPath);
    });

    // Pipe all archive data to be written
    archive.pipe(output);

    // gcloudignore
    let gIgnoreF = undefined;
    if (getGcloudIgnores(dirPath).length > 0) {
      const gIgnore = ignore().add(getGcloudIgnores(dirPath));
      gIgnoreF = function (
        file: Archiver.EntryData,
      ): false | Archiver.EntryData {
        return !gIgnore.ignores(file.name) ? file : false;
      };
    }

    // Add files in dir to archive iff file not ignored
    archive.directory(dirPath, false, gIgnoreF);

    // Finish writing files
    archive.finalize();
  });
}

/**
 * @param dir dir which may contain .gcloudignore file
 * @returns list of ignores in .gcloudignore if present
 */
export function getGcloudIgnores(dir: string): string[] {
  const gcloudIgnorePath = path.posix.join(dir, '.gcloudignore');
  if (!fs.existsSync(gcloudIgnorePath)) {
    return [];
  }
  // read .gcloudignore, split on newline
  return fs
    .readFileSync(gcloudIgnorePath, { encoding: 'utf-8' })
    .toString()
    .split(/\r?\n/)
    .map((s) => s.trim());
}

/**
 * removeFile removes the file at the given path. If the file does not exist, it
 * does nothing.
 *
 * TODO(sethvargo): Candidate for centralization.
 *
 * @param filePath Path of the file on disk to delete.
 * @returns Path of the file that was removed.
 */
export function removeFile(filePath: string): string {
  try {
    fs.unlinkSync(filePath);
    return filePath;
  } catch (err) {
    const msg = errorMessage(err);

    if (msg.includes('ENOENT')) {
      return '';
    }

    throw new Error(`Failed to file: ${msg}`);
  }
}

/**
 * fromBase64 base64 decodes the result, taking into account URL and standard
 * encoding with and without padding.
 *
 * TODO(sethvargo): Candidate for centralization.
 *
 */
export function fromBase64(s: string): string {
  let str = s.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

export type ServiceAccountKey = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
};

/**
 * parseServiceAccountKeyJSON attempts to parse the given string as a service
 * account key JSON. It handles if the string is base64-encoded.
 *
 * TODO(sethvargo): Candidate for centralization.
 */
export function parseServiceAccountKeyJSON(
  str: string,
): ServiceAccountKey | ExternalAccountClientOptions {
  if (!str) str = '';

  str = str.trim();
  if (!str) {
    throw new Error(`Missing service account key JSON (got empty value)`);
  }

  // If the string doesn't start with a JSON object character, it is probably
  // base64-encoded.
  if (!str.startsWith('{')) {
    str = fromBase64(str);
  }

  let creds: ServiceAccountKey | ExternalAccountClientOptions;
  try {
    creds = JSON.parse(str);
  } catch (err) {
    const msg = errorMessage(err);
    throw new SyntaxError(
      `Failed to parse service account key JSON credentials: ${msg}`,
    );
  }

  return creds;
}

/**
 * isServiceAccountKey returns true if the given interface is a
 * ServiceAccountKey, false otherwise.
 */
export function isServiceAccountKey(
  obj: ServiceAccountKey | ExternalAccountClientOptions,
): obj is ServiceAccountKey {
  return (obj as ServiceAccountKey).project_id !== undefined;
}

/**
 * KVPair represents a KEY=VALUE pair of strings.
 */
type KVPair = Record<string, string>;

/**
 * Parses a string of the format `KEY1=VALUE1,KEY2=VALUE2`.
 *
 * TODO(sethvargo): Candidate for centralization.
 *
 * @param str String with key/value pairs to parse.
 */
export function parseKVString(str: string): KVPair {
  if (!str || str.trim().length === 0) {
    return {};
  }

  const result: KVPair = {};

  // This regular expression uses a lookahead to split on commas which are not
  // preceeded by an escape character (slash).
  const pairs = str.split(/(?<!\\),/gi);
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    let [k, v] = pair.split('=', 2);
    if (!k || !v) {
      throw new SyntaxError(`Failed to parse KEY=VALUE pair "${pair}"`);
    }

    // Trim any key whitespace and un-escape any escaped commas.
    k = k.trim();
    k = k.replace(/\\,/gi, ',');

    // Trim any value whitespace and un-escape any escaped commas.
    v = v.trim();
    v = v.replace(/\\,/gi, ',');

    result[k] = v;
  }

  return result;
}

/**
 * Read and parse an env var file.
 *
 * @param filePath Path to the file on disk to parse.
 */
export function parseKVFile(filePath: string): KVPair {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    const msg = errorMessage(err);
    throw new Error(`Failed to read file '${filePath}': ${msg}`);
  }

  return parseKVYAML(content);
}

/**
 * Read and parse contents of the string as YAML. This is mostly just exposed
 * for testing.
 *
 * @param str YAML content to parse as K=V pairs.
 */
export function parseKVYAML(str: string): KVPair {
  if (!str || str.trim().length === 0) {
    return {};
  }

  const yamlContent = YAML.parse(str) as KVPair;

  const result: KVPair = {};
  for (const [k, v] of Object.entries(yamlContent)) {
    if (typeof k !== 'string' || typeof v !== 'string') {
      throw new SyntaxError(
        `env_vars_file must contain only KEY: VALUE strings. Error parsing key ${k} of type ${typeof k} with value ${v} of type ${typeof v}`,
      );
    }
    result[k.trim()] = v.trim();
  }

  return result;
}

/**
 * parseKVStringAndFile parses the given KV string and KV file, merging the
 * results (with kvString taking precedence).
 *
 * @param kvString String of KEY=VALUE pairs.
 * @param kvFilePath Path on disk to a YAML file of KEY: VALUE pairs.
 */
export function parseKVStringAndFile(
  kvString?: string,
  kvFilePath?: string,
): KVPair {
  kvString = (kvString || '').trim();
  kvFilePath = (kvFilePath || '').trim();

  let result: Record<string, string> = {};

  if (kvFilePath) {
    const parsed = parseKVFile(kvFilePath);
    result = { ...result, ...parsed };
  }

  if (kvString) {
    const parsed = parseKVString(kvString);
    result = { ...result, ...parsed };
  }

  return result;
}

/**
 * presence takes the given string and converts it to undefined iff it's null,
 * undefined, or the empty string. Otherwise, it returns the trimmed string.
 *
 * TODO(sethvargo): Candidate for centralization.
 *
 * @param str The string to check
 */
export function presence(str: string | null | undefined): string | undefined {
  if (!str) return undefined;

  str = str.trim();
  if (!str) return undefined;

  return str;
}

/**
 * errorMessage extracts the error message from the given error.
 *
 * TODO(sethvargo): Candidate for centralization.
 *
 */
export function errorMessage(err: unknown): string {
  if (!err) {
    return '';
  }

  let msg = err instanceof Error ? err.message : `${err}`;
  msg = msg.trim();
  msg = msg.replace('Error: ', '');
  msg = msg.trim();

  if (!msg) {
    return '';
  }

  msg = msg[0].toLowerCase() + msg.slice(1);
  return msg;
}

/**
 * parseDuration parses a user-supplied string duration with optional suffix and
 * returns a number representing the number of seconds. It returns 0 when given
 * the empty string.
 *
 * TODO(sethvargo): Candidate for centralization.
 *
 * @param str Duration string
 */
export function parseDuration(str: string): number {
  const given = (str || '').trim();
  if (!given) {
    return 0;
  }

  let total = 0;
  let curr = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    switch (ch) {
      case ' ':
        continue;
      case ',':
        continue;
      case 's': {
        total += +curr;
        curr = '';
        break;
      }
      case 'm': {
        total += +curr * 60;
        curr = '';
        break;
      }
      case 'h': {
        total += +curr * 60 * 60;
        curr = '';
        break;
      }

      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        curr += ch;
        break;
      default:
        throw new SyntaxError(`Unsupported character "${ch}" at position ${i}`);
    }
  }

  // Anything left over is seconds
  if (curr) {
    total += +curr;
  }

  return total;
}
