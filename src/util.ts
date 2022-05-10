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
import * as path from 'path';

import * as Archiver from 'archiver';
import { parseGcloudIgnore, toPlatformPath } from '@google-github-actions/actions-utils';
import ignore from 'ignore';

/**
 * OnZipEntryFunction is a function that is called for each entry in the
 * archive.
 */
export type OnZipEntryFunction = (entry: Archiver.EntryData) => void;

/**
 * ZipOptions is used as input to the zip function.
 */
export type ZipOptions = {
  onZipEntry?: OnZipEntryFunction;
};

/**
 * Zip a directory.
 *
 * @param dirPath Directory to zip.
 * @param outputPath Path to output file.
 * @param opts Options with which to invoke the zip.
 * @returns filepath of the created zip file.
 */
export async function zipDir(
  dirPath: string,
  outputPath: string,
  opts?: ZipOptions,
): Promise<string> {
  // Check dirpath
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Unable to find ${dirPath}`);
  }

  // Create output file stream
  const output = fs.createWriteStream(outputPath);

  // Process gcloudignore
  const ignoreFile = toPlatformPath(path.join(dirPath, '.gcloudignore'));
  const ignores = await parseGcloudIgnore(ignoreFile);
  const ignorer = ignore().add(ignores);
  const ignoreFn = (entry: Archiver.EntryData): false | Archiver.EntryData => {
    return ignorer.ignores(entry.name) ? false : entry;
  };

  return new Promise((resolve, reject) => {
    // Initialize archive
    const archive = Archiver.create('zip', { zlib: { level: 7 } });
    archive.on('entry', (entry) => {
      // For some reason, TypeScript complains if this guard is outside the
      // closure. It would be more performant just not create this listener, but
      // alas...
      if (opts?.onZipEntry) opts.onZipEntry(entry);
    });
    archive.on('warning', (err) => reject(err));
    archive.on('error', (err) => reject(err));
    output.on('finish', () => resolve(outputPath));

    // Pipe all archive data to be written
    archive.pipe(output);

    // Add files in dir to archive iff file not ignored
    archive.directory(dirPath, false, ignoreFn);

    // Finish writing files
    archive.finalize();
  });
}

/**
 * RealEntryData is an extended form of entry data.
 */
type RealEntryData = Archiver.EntryData & {
  sourcePath?: string;
  type?: string;
};

/**
 * formatEntry formats the given entry data into a single-line string.
 * @returns string
 */
export function formatEntry(entry: RealEntryData): string {
  const name = entry.name;
  const mode = entry.mode || '000';
  const sourcePath = entry.sourcePath || 'unknown';
  const type = (entry.type || 'unknown').toUpperCase()[0];
  return `[${type}] (${mode}) ${name} => ${sourcePath}`;
}
