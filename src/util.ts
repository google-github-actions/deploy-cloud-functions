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
      gIgnoreF = function (file: Archiver.EntryData): false | Archiver.EntryData {
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
