/*
 * Copyright 2021 Google LLC
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

import { randomBytes } from 'crypto';
import fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

import { HttpClient } from '@actions/http-client';
import { GoogleAuth } from 'google-auth-library';
import {
  errorMessage,
  expandUniverseEndpoints,
  forceRemove,
  KVPair,
} from '@google-github-actions/actions-utils';

import { zipDir, ZipOptions } from './util';

// Do not listen to the linter - this can NOT be rewritten as an ES6 import statement.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: appVersion } = require('../package.json');

// userAgent is the default user agent.
const userAgent = `google-github-actions:deploy-cloud-functions/${appVersion}`;

// cloudFunctionResourceNamePattern is the regular expression to use to match
// resource names.
const cloudFunctionResourceNamePattern = new RegExp(
  /^projects\/.+\/locations\/.+\/functions\/.+$/gi,
);

export type CloudFunctionClientOptions = {
  projectID?: string;
  location?: string;
  universe?: string;
};

export type PollOperationOptions = {
  onPoll?: OnFunction;
  onDebug?: OnDebugFunction;
};

export type Operation = {
  name: string;
  metadata: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  done: boolean;
  error: OperationStatus;
  response?: CloudFunctionResponse;
};

export type OperationStatus = {
  code: number;
  message: string;
};

export type CloudFunctionResponse = CloudFunction & {
  buildConfig: {
    build: string;
  };
  serviceConfig: {
    service: string;
    uri: string;
    revision: string;
  };
  eventTrigger: {
    trigger: string;
  };
  state: 'STATE_UNSPECIFIED' | 'ACTIVE' | 'FAILED' | 'DEPLOYING' | 'DELETING' | 'UNKNOWN';
  updateTime: string;
  stateMessages: {
    severity: 'SEVERITY_UNSPECIFIED' | 'ERROR' | 'WARNING' | 'INFO';
    type: string;
    message: string;
  }[];
  url: string;
};

type GenerateUploadUrlResponse = {
  uploadUrl: string;
  storageSource: StorageSource;
};

export type StorageSource = {
  bucket: string;
  object: string;
  generation?: string;
};

export type SecretEnvVar = {
  key: string;
  projectId: string;
  secret: string;
  version: string;
};

export type SecretVolume = {
  mountPath: string;
  projectId: string;
  secret: string;
  versions: {
    path: string;
    version: string;
  }[];
};

export type EventFilter = {
  attribute: string;
  value: string;
  operator?: string;
};

export enum Environment {
  GEN_1 = 'GEN_1',
  GEN_2 = 'GEN_2',
}

export enum VpcConnectorEgressSettings {
  PRIVATE_RANGES_ONLY = 'PRIVATE_RANGES_ONLY',
  ALL_TRAFFIC = 'ALL_TRAFFIC',
}

export enum IngressSettings {
  ALLOW_ALL = 'ALLOW_ALL',
  ALLOW_INTERNAL_ONLY = 'ALLOW_INTERNAL_ONLY',
  ALLOW_INTERNAL_AND_GCLB = 'ALLOW_INTERNAL_AND_GCLB',
}

export enum RetryPolicy {
  RETRY_POLICY_DO_NOT_RETRY = 'RETRY_POLICY_DO_NOT_RETRY',
  RETRY_POLICY_RETRY = 'RETRY_POLICY_RETRY',
}

export type CloudFunction = {
  name: string;
  description?: string;
  environment?: Environment;
  kmsKeyName?: string;
  labels?: KVPair;

  buildConfig?: {
    runtime?: string;
    entryPoint?: string;
    source?: {
      storageSource?: StorageSource;
    };
    dockerRepository?: string;
    environmentVariables?: KVPair;
    serviceAccount?: string;
    workerPool?: string;
  };

  serviceConfig?: {
    allTrafficOnLatestRevision?: boolean;
    availableCpu?: string;
    availableMemory?: string;
    environmentVariables?: KVPair;
    ingressSettings: IngressSettings;
    maxInstanceCount?: number;
    maxInstanceRequestConcurrency?: number;
    minInstanceCount?: number;
    secretEnvironmentVariables?: SecretEnvVar[];
    secretVolumes?: SecretVolume[];
    serviceAccountEmail?: string;
    timeoutSeconds?: number;
    vpcConnector?: string;
    vpcConnectorEgressSettings?: VpcConnectorEgressSettings;
  };

  eventTrigger?: {
    triggerRegion?: string;
    eventType?: string;
    eventFilters?: EventFilter[];
    pubsubTopic?: string;
    serviceAccountEmail?: string;
    retryPolicy?: RetryPolicy;
    channel?: string;
    service?: string;
  };
};

export type CreateOptions = {
  onPoll?: OnFunction;
  onDebug?: OnDebugFunction;
};

export type DeleteOptions = {
  onPoll?: OnFunction;
  onDebug?: OnDebugFunction;
};

export type PatchOptions = {
  onPoll?: OnFunction;
  onDebug?: OnDebugFunction;
};

export type DeployOptions = {
  onPoll?: OnFunction;
  onZip?: OnZipFunction;
  onNew?: OnFunction;
  onExisting?: OnFunction;
  onDebug?: OnDebugFunction;
} & ZipOptions;

export type OnFunction = () => void;
export type OnDebugFunction = (f: () => string) => void;
export type OnZipFunction = (sourceDir: string, zipPath: string) => void;

export class CloudFunctionsClient {
  /**
   * auth is the authentication client.
   */
  readonly #auth: GoogleAuth;

  /**
   * projectID and location are hints to the client if a Cloud Function resource
   * name does not include the full resource name. If a full resource name is
   * given (e.g. `projects/p/locations/l/functions/f`), then that is used.
   * However, if just a name is given (e.g. `f`), these values will be used to
   * construct the full resource name.
   */
  readonly #projectID?: string;
  readonly #location?: string;

  /**
   * client is the HTTP client.
   */
  readonly #client: HttpClient;

  /**
   * endpoints are the universe-aware API endpoints.
   */
  readonly #endpoints = {
    cloudfunctions: 'https://cloudfunctions.{universe}/v2',
  };

  constructor(opts?: CloudFunctionClientOptions) {
    this.#auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      projectId: opts?.projectID,
    });

    this.#projectID = opts?.projectID;
    this.#location = opts?.location;

    this.#client = new HttpClient(userAgent);
    this.#endpoints = expandUniverseEndpoints(this.#endpoints, opts?.universe);
  }

  async #request(
    method: string,
    url: string,
    data?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  ) {
    const authToken = await this.#auth.getAccessToken();
    if (!authToken) {
      throw new Error(`Failed to get auth token for ${method} ${url}`);
    }

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    try {
      const response = await this.#client.request(method, url, data, headers);
      const body = await response.readBody();
      const statusCode = response.message.statusCode || 500;
      if (statusCode >= 400) {
        throw new Error(`(${statusCode}) ${body}`);
      }
      return JSON.parse(body);
    } catch (err) {
      const msg = errorMessage(err);
      throw new Error(`Failed to ${method} ${url}: ${msg}`);
    }
  }

  /**
   * pollOperation polls the operation, calling pollFn on each attempt.
   *
   * @param name Name of the operation, of the format `operations/{name}`.
   * @param opts Options for polling
   */
  async #pollOperation(name: string, opts: PollOperationOptions): Promise<Operation> {
    const pollInterval = 5000; // ms

    for (;;) {
      // If a poll function was given, call it.
      if (opts.onPoll) opts.onPoll();

      const resp = await this.getOperation(name);
      if (resp.error) {
        throw new Error(`Operation failed: ${resp.error.message}`);
      }
      if (resp.done) {
        return resp;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * getOperation fetches the operation by name.
   *
   * @param name Name of the operation, of the format `operations/{name}`.
   */
  async getOperation(name: string): Promise<Operation> {
    if (name.startsWith('operations/')) {
      name.slice(11);
    }

    const u = `${this.#endpoints.cloudfunctions}/${name}`;
    const resp: Operation = await this.#request('GET', u);
    return resp;
  }

  /**
   * create creates a new Cloud Function.
   *
   * @param cf Cloud Function to deploy.
   */
  async create(cf: CloudFunction, opts?: CreateOptions): Promise<CloudFunctionResponse> {
    const resourceName = this.fullResourceName(cf.name);
    cf.name = resourceName;
    if (opts?.onDebug) {
      opts.onDebug((): string => {
        return `create: computed Cloud Function:\n${JSON.stringify(cf, null, 2)}`;
      });
    }

    const parent = this.parentFromName(resourceName);
    const functionName = resourceName.split('/').at(-1);

    const u = `${this.#endpoints.cloudfunctions}/${parent}/functions?functionId=${functionName}`;
    const body = JSON.stringify(cf);

    const resp: Operation = await this.#request('POST', u, body);
    const op = await this.#pollOperation(resp.name, {
      onPoll: opts?.onPoll,
      onDebug: opts?.onDebug,
    });

    if (!op.response) {
      throw new Error(`create operation result did not include function`);
    }
    return op.response;
  }

  /**
   * delete removes a function with the given name.
   *
   * @param name Full resource name of the Cloud Function.
   */
  async delete(name: string, opts?: DeleteOptions): Promise<Operation> {
    const resourceName = this.fullResourceName(name);
    const u = `${this.#endpoints.cloudfunctions}/${resourceName}`;
    const resp: Operation = await this.#request('DELETE', u);
    return await this.#pollOperation(resp.name, {
      onPoll: opts?.onPoll,
      onDebug: opts?.onDebug,
    });
  }

  /**
   * generateUploadURL generates a signed URL for which to upload the blob.
   *
   * @param parent Name of the location in which to deploy the function, of the
   * format `projects/p/locations/l`.
   */
  async generateUploadURL(parent: string): Promise<GenerateUploadUrlResponse> {
    const u = `${this.#endpoints.cloudfunctions}/${parent}/functions:generateUploadUrl`;
    const body = JSON.stringify({
      environment: Environment.GEN_2,
    });
    const resp: GenerateUploadUrlResponse = await this.#request('POST', u, body);
    return resp;
  }

  /**
   * get returns a function with the given name.
   *
   * @param name Name of the function to get, of the format
   * `projects/p/locations/l/functions/f`.
   */
  async get(name: string): Promise<CloudFunctionResponse> {
    const resourceName = this.fullResourceName(name);
    const u = `${this.#endpoints.cloudfunctions}/${resourceName}`;
    const resp: CloudFunctionResponse = await this.#request('GET', u);
    return resp;
  }

  /**
   * getSafe attempts to get the existing function by resource name.
   * If the function exists, it returns the function. If the function does not
   * exist, it returns null. If there are any errors besides a 404 returned, it
   * throws that error.
   */
  async getSafe(name: string): Promise<CloudFunction | null> {
    try {
      return await this.get(name);
    } catch (err) {
      const msg = errorMessage(err);
      if (!msg.includes('404') && !msg.includes('NOT_FOUND')) {
        throw new Error(
          `Failed to lookup existing function - does the caller have ` +
            `cloudfunctions.functions.get permissions? ${err}`,
        );
      }
      return null;
    }
  }

  /**
   * patch updates fields on the function.
   *
   * @param cf Cloud Function to patch
   */
  async patch(cf: CloudFunction, opts?: PatchOptions): Promise<CloudFunctionResponse> {
    const resourceName = this.fullResourceName(cf.name);
    cf.name = resourceName;
    if (opts?.onDebug) {
      opts.onDebug((): string => {
        return `patch: computed Cloud Function:\n${JSON.stringify(cf, null, 2)}`;
      });
    }

    const updateMask = this.computeUpdateMask(cf);
    if (opts?.onDebug) {
      opts.onDebug((): string => {
        return `Computed updateMask: ${updateMask}`;
      });
    }

    const u = `${this.#endpoints.cloudfunctions}/${resourceName}?updateMask=${updateMask}`;
    const body = JSON.stringify(cf);
    const resp: Operation = await this.#request('PATCH', u, body);
    const op = await this.#pollOperation(resp.name, {
      onPoll: opts?.onPoll,
      onDebug: opts?.onDebug,
    });

    if (!op.response) {
      throw new Error(`patch operation result did not include function`);
    }
    return op.response;
  }

  /**
   * deployFromLocalSource deploys a function. If the function already exists, it deploys a new
   * version. If the function does not already exist, it creates a new one. This is not an API method, but rather a helper around a collection of API methods.
   *
   * @param cf Cloud Function.
   * @param sourceDir Path on local disk to the source to deploy.
   */
  async deployFromLocalSource(
    cf: CloudFunction,
    sourceDir: string,
    opts?: DeployOptions,
  ): Promise<CloudFunctionResponse> {
    const randomName = randomBytes(12).toString('hex');
    const zipPath = path.join(tmpdir(), `cfsrc-${randomName}.zip`);
    try {
      await zipDir(sourceDir, zipPath, opts);
      if (opts?.onZip) opts.onZip(sourceDir, zipPath);
    } catch (err) {
      throw new Error(`Zip file ${zipPath} creation failed: ${err}`);
    }

    const resourceName = this.fullResourceName(cf.name);
    cf.name = resourceName;

    // Extract the parent from the name attribute.
    const parent = this.parentFromName(resourceName);

    // Upload source code to the upload URL.
    let sourceUploadResp: GenerateUploadUrlResponse;
    try {
      sourceUploadResp = await this.generateUploadURL(parent);
      await this.uploadSource(sourceUploadResp.uploadUrl, zipPath);
    } catch (err) {
      throw new Error(`Failed to upload zip file: ${err}`);
    }

    // Delete temp zip file after upload
    await forceRemove(zipPath);
    if (!cf.buildConfig) {
      cf.buildConfig = {};
    }
    if (!cf.buildConfig.source) {
      cf.buildConfig.source = {};
    }
    cf.buildConfig.source.storageSource = sourceUploadResp.storageSource;

    // Get the existing function data.
    const existingFunction = await this.getSafe(resourceName);

    // If the function already exists, create a new version
    if (existingFunction) {
      if (opts?.onExisting) opts.onExisting();
      const resp: CloudFunctionResponse = await this.patch(cf, {
        onPoll: opts?.onPoll,
        onDebug: opts?.onDebug,
      });
      return resp;
    } else {
      if (opts?.onNew) opts.onNew();
      const resp: CloudFunctionResponse = await this.create(cf, {
        onPoll: opts?.onPoll,
        onDebug: opts?.onDebug,
      });
      return resp;
    }
  }

  /**
   * Upload a file to a Signed URL.
   *
   * @param uploadURL Signed URL.
   * @param zipPath File to upload.
   * @returns uploaded URL.
   */
  async uploadSource(uploadURL: string, zipPath: string): Promise<void> {
    const zipFile = fs.createReadStream(zipPath);

    try {
      // This is different logic than the primary request function, and it does
      // not return JSON.
      const response = await this.#client.request('PUT', uploadURL, zipFile, {
        'content-type': 'application/zip',
      });

      const body = await response.readBody();
      const statusCode = response.message.statusCode || 500;
      if (statusCode >= 400) {
        throw new Error(`(${statusCode}) ${body}`);
      }
    } catch (err) {
      const msg = errorMessage(err);
      throw new Error(`Failed to upload source: ${msg}`);
    }
  }

  fullResourceName(name: string): string {
    if (!name) {
      name = '';
    }

    name = name.trim();
    if (!name) {
      throw new Error(`Failed to parse resource name: name cannot be empty`);
    }

    if (name.includes('/')) {
      if (name.match(cloudFunctionResourceNamePattern)) {
        return name;
      } else {
        throw new Error(`Invalid resource name '${name}'`);
      }
    }

    const projectID = this.#projectID;
    if (!projectID) {
      throw new Error(`Failed to get project ID to build resource name. Try setting 'project_id'.`);
    }

    const location = this.#location;
    if (!location) {
      throw new Error(
        `Failed to get location (region) to build resource name. Try setting 'region'.`,
      );
    }

    return `projects/${projectID}/locations/${location}/functions/${name}`;
  }

  parentFromName(name: string): string {
    const parts = name.split('/');
    if (parts.length < 3) {
      throw new Error(
        `Invalid or missing name '${name}' (expected 'projects/p/locations/l/functions/f')`,
      );
    }
    const parent = parts.slice(0, parts.length - 2).join('/');
    return parent;
  }

  computeUpdateMask(cf: CloudFunction): string {
    const keys: string[] = [];

    const iter = (obj: object, root?: string) => {
      for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) {
          continue;
        }

        const pth = root ? root + '.' + k : k;
        if (typeof v === 'object' && !Array.isArray(v)) {
          iter(v, pth);
        } else {
          keys.push(pth);
        }
      }
    };

    iter(cf);

    return keys.join(',');
  }
}
