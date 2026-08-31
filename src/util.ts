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
import { posix } from 'path';
import * as path from 'path';

import * as Archiver from 'archiver';
import {
  parseCSV,
  parseGcloudIgnore,
  parseKVString,
  toPlatformPath,
} from '@google-github-actions/actions-utils';
import ignore from 'ignore';

import {
  DirectVpcEgress,
  DirectVpcNetworkInterface,
  Environment,
  EventFilter,
  SecretEnvVar,
  SecretVolume,
} from './client';
import { SecretName } from './secret';

/**
 * OnZipEntryFunction is a function that is called for each entry in the
 * archive.
 */
export type OnZipEntryFunction = (entry: Archiver.EntryData) => void;

/**
 * ZipOptions is used as input to the zip function.
 */
export type ZipOptions = {
  /**
   * onZipAddEntry is called when an entry is added to the archive.
   */
  onZipAddEntry?: OnZipEntryFunction;

  /**
   * onZipIgnoreEntry is called when an entry is ignored due to an ignore
   * specification.
   */
  onZipIgnoreEntry?: OnZipEntryFunction;
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
    if (ignorer.ignores(entry.name)) {
      if (opts?.onZipIgnoreEntry) opts.onZipIgnoreEntry(entry);
      return false;
    }
    return entry;
  };

  return new Promise((resolve, reject) => {
    // Initialize archive
    const archive = Archiver.create('zip', { zlib: { level: 7 } });
    archive.on('entry', (entry) => {
      // For some reason, TypeScript complains if this guard is outside the
      // closure. It would be more performant just not create this listener, but
      // alas...
      if (opts?.onZipAddEntry) opts.onZipAddEntry(entry);
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

/**
 * stringToInt is a helper that converts the given string into an integer. If
 * the given string is empty, it returns undefined. If the string is not empty
 * and parseInt fails (returns NaN), it throws an error. Otherwise, it returns
 * the integer value.
 *
 * @param str String to parse as an int.
 * @returns Parsed integer or undefined if the input was the empty string.
 */
export function stringToInt(str: string): number | undefined {
  str = (str || '').trim().replace(/[_,]/g, '');
  if (str === '') {
    return undefined;
  }

  const result = parseInt(str);
  if (isNaN(result)) {
    throw new Error(`input "${str}" is not a number`);
  }
  return result;
}

/**
 * parseEventTriggerFilters is a helper that parses the inputs into a list of event
 * filters.
 */
export function parseEventTriggerFilters(val: string): EventFilter[] | undefined {
  const kv = parseKVString(val);
  if (kv === undefined) {
    return undefined;
  }

  const result: EventFilter[] = [];
  for (const [key, value] of Object.entries(kv)) {
    if (value.startsWith('PATTERN:')) {
      result.push({
        attribute: key,
        value: value.slice(8),
        operator: 'match-path-pattern',
      });
    } else {
      result.push({
        attribute: key,
        value: value,
      });
    }
  }

  return result;
}

/**
 * parseSecrets parses the input as environment variable and volume mounted
 * secrets.
 */
export function parseSecrets(
  val: string,
): [SecretEnvVar[] | undefined, SecretVolume[] | undefined] {
  const kv = parseKVString(val);
  if (kv === undefined) {
    return [undefined, undefined];
  }

  const secretEnvVars: SecretEnvVar[] = [];
  const secretVolumes: SecretVolume[] = [];
  for (const [key, value] of Object.entries(kv)) {
    const secretRef = new SecretName(value);

    if (key.startsWith('/')) {
      // SecretVolume
      const mountPath = posix.dirname(key);
      const pth = posix.basename(key);

      secretVolumes.push({
        mountPath: mountPath,
        projectId: secretRef.project,
        secret: secretRef.name,
        versions: [
          {
            path: pth,
            version: secretRef.version,
          },
        ],
      });
    } else {
      // SecretEnvVar
      secretEnvVars.push({
        key: key,
        projectId: secretRef.project,
        secret: secretRef.name,
        version: secretRef.version,
      });
    }
  }

  return [secretEnvVars, secretVolumes];
}

/**
 * DirectVpcInputs holds raw user inputs related to Direct VPC Egress.
 */
export type DirectVpcInputs = {
  environment?: Environment;
  vpcConnector?: string;
  network?: string;
  subnet?: string;
  networkTags?: string;
  directVpcEgress?: string;
};

/**
 * DirectVpcConfig holds parsed Direct VPC configuration for CloudFunction.
 */
export type DirectVpcConfig = {
  directVpcNetworkInterface?: DirectVpcNetworkInterface[];
  directVpcEgress?: DirectVpcEgress;
};

/**
 * parseDirectVpcEgress parses direct_vpc_egress input into DirectVpcEgress enum.
 */
export function parseDirectVpcEgress(val?: string): DirectVpcEgress | undefined {
  if (!val) {
    return undefined;
  }
  const normalized = val.trim().toUpperCase().replace(/-/g, '_');
  if (normalized === 'ALL_TRAFFIC' || normalized === 'VPC_EGRESS_ALL_TRAFFIC') {
    return DirectVpcEgress.VPC_EGRESS_ALL_TRAFFIC;
  }
  if (normalized === 'PRIVATE_RANGES_ONLY' || normalized === 'VPC_EGRESS_PRIVATE_RANGES_ONLY') {
    return DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY;
  }
  throw new Error(
    `Invalid value '${val}' for 'direct_vpc_egress', valid values are 'all-traffic', 'private-ranges-only'`,
  );
}

/**
 * parseDirectVpc validates and parses Direct VPC inputs into DirectVpcConfig.
 */
export function parseDirectVpc(inputs: DirectVpcInputs): DirectVpcConfig {
  const { environment, vpcConnector, network, subnet, networkTags, directVpcEgress } = inputs;
  const hasDirectVpcSettings = Boolean(network || subnet || networkTags || directVpcEgress);

  if (!hasDirectVpcSettings) {
    return {};
  }

  if (environment === Environment.GEN_1) {
    throw new Error(
      `Direct VPC Egress is only supported on 2nd gen Cloud Functions (got environment: 'GEN_1')`,
    );
  }

  if (vpcConnector) {
    throw new Error(
      `Cannot specify both 'vpc_connector' and Direct VPC settings ('network'/'subnet')`,
    );
  }

  if (!network && !subnet) {
    throw new Error(
      `Cannot specify 'network_tags' or 'direct_vpc_egress' without specifying 'network' or 'subnet'`,
    );
  }

  const tags = networkTags ? parseCSV(networkTags) : undefined;
  const egress = directVpcEgress
    ? parseDirectVpcEgress(directVpcEgress)
    : DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY;

  const directVpcInterface: DirectVpcNetworkInterface = {};
  if (network) directVpcInterface.network = network;
  if (subnet) directVpcInterface.subnetwork = subnet;
  if (tags && tags.length > 0) directVpcInterface.tags = tags;

  return {
    directVpcNetworkInterface: [directVpcInterface],
    directVpcEgress: egress,
  };
}
