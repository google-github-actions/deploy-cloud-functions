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

import * as fs from 'fs';
import * as core from '@actions/core';
import { Gaxios } from 'gaxios';
import * as Archiver from 'archiver';
import * as path from 'path';
import ignore from 'ignore';

/**
 * Zip a directory.
 *
 * @param dirPath Directory to zip.
 * @returns filepath of the created zip file.
 */
export async function zipDir(
  dirPath: string,
  outputPath: string,
): Promise<string> {
  // Check dirpath
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Unable to find ${dirPath}`);
  }
  return new Promise((resolve, reject) => {
    // Create output file stream
    const output = fs.createWriteStream(outputPath);
    output.on('finish', () => {
      core.info(`zip file ${outputPath} created successfully`);
      resolve(outputPath);
    });
    // Init archive
    const archive = Archiver.create('zip');
    // log archive warnings
    archive.on('warning', (err: Archiver.ArchiverError) => {
      if (err.code === 'ENOENT') {
        core.info(err.message);
      } else {
        reject(err);
      }
    });
    // listen for all archive data to be written
    output.on('close', function () {
      core.info(`function source zipfile created: ${archive.pointer()} bytes`);
    });
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
 * Deletes a zip file from disk.
 *
 * @param filePath File to delete.
 * @returns Boolean success/failure.
 */
export async function deleteZipFile(filePath: string): Promise<boolean> {
  // check dirpath
  if (!fs.existsSync(filePath)) {
    throw new Error(`Unable to find ${filePath}`);
  }
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(err);
      return false;
    }
  });
  return true;
}

/**
 * Upload a file to a Signed URL.
 *
 * @param uploadUrl Signed URL.
 * @param zipPath File to upload.
 * @returns uploaded URL.
 */
export async function uploadSource(
  uploadUrl: string,
  zipPath: string,
): Promise<string> {
  const zipFile = fs.createReadStream(zipPath);
  const client = new Gaxios({ retryConfig: { retry: 5 } });
  const resp = await client.request({
    method: 'PUT',
    body: zipFile,
    url: uploadUrl,
    headers: {
      'content-type': 'application/zip',
      'x-goog-content-length-range': '0,104857600',
    },
  });
  if (resp.status != 200) {
    throw new Error(
      `Failed to upload function source code: ${resp.statusText}`,
    );
  }
  core.info(`zip file ${zipPath} uploaded successfully`);
  return uploadUrl;
}
