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

import { RequestOptions } from 'https';
import { randomBytes } from 'crypto';
import fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

import {
  CredentialBody,
  ExternalAccountClientOptions,
  GoogleAuth,
} from 'google-auth-library';
import {
  errorMessage,
  request,
  removeFile,
} from '@google-github-actions/actions-utils';

import { zipDir, ZipOptions } from './util';

// Do not listen to the linter - this can NOT be rewritten as an ES6 import statement.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: appVersion } = require('../package.json');

// userAgent is the default user agent.
const userAgent = `google-github-actions:deploy-cloud-functions/${appVersion}`;

// defaultBaseURL is the URL for Cloud Functions.
const defaultBaseURL = 'https://cloudfunctions.googleapis.com/v1';

// defaultTimeout is the default timeout in seconds.
const defaultTimeout = 300;

// cloudFunctionResourceNamePattern is the regular expression to use to match
// resource names.
const cloudFunctionResourceNamePattern = new RegExp(
  /^projects\/.+\/locations\/.+\/functions\/.+$/gi,
);

export type CloudFunctionClientOptions = {
  projectID?: string;
  location?: string;
  credentials?: CredentialBody | ExternalAccountClientOptions;
  baseURL?: string;
};

export type PollOperationOptions = {
  retries: number;
  interval: number;
  onPoll?: OnFunction;
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

export type KVPair = Record<string, string>;

export type CloudFunction = {
  name: string;
  runtime: string;
  description?: string;
  availableMemoryMb?: number;
  buildEnvironmentVariables?: KVPair;
  buildWorkerPool?: string;
  dockerRepository?: string;
  entryPoint?: string;
  environmentVariables?: KVPair;
  ingressSettings?: string;
  kmsKeyName?: string;
  labels?: KVPair;
  maxInstances?: number;
  minInstances?: number;
  network?: string;
  secretEnvironmentVariables?: SecretEnvVar[];
  secretVolumes?: SecretVolume[];
  serviceAccountEmail?: string;
  sourceToken?: string;
  timeout?: string;
  vpcConnector?: string;
  vpcConnectorEgressSettings?: string;

  // oneof
  sourceArchiveUrl?: string;
  sourceRepository?: SourceRepository;
  sourceUploadUrl?: string;

  // oneof
  httpsTrigger?: HTTPSTrigger;
  eventTrigger?: EventTrigger;
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

export type CloudFunctionResponse = CloudFunction & {
  status: string;
  updateTime: string;
  versionId: string;
  buildName?: string;
  buildId?: string;
};

export type SourceRepository = {
  url: string;
  deployedUrl: string;
};

export type HTTPSTrigger = {
  url?: string;
  securityLevel?: string;
};

export type EventTrigger = {
  eventType: string;
  resource: string;
  service?: string;
  failurePolicy?: FailurePolicy;
};

export type FailurePolicy = {
  retry: Record<string, string>;
};

export type CreateOptions = {
  timeout?: number;
  onPoll?: OnFunction;
};

export type DeleteOptions = {
  timeout?: number;
  onPoll?: OnFunction;
};

export type PatchOptions = {
  timeout?: number;
  onPoll?: OnFunction;
};

export type DeployOptions = {
  timeout?: number;
  onPoll?: OnFunction;
  onZip?: OnZipFunction;
  onNew?: OnFunction;
  onExisting?: OnFunction;
} & ZipOptions;

export type OnFunction = () => void;
export type OnZipFunction = (sourceDir: string, zipPath: string) => void;

export class CloudFunctionsClient {
  /**
   * request is a high-level helper that returns a promise from the executed
   * request.
   */
  static async request(
    method: string,
    url: string,
    data?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    opts?: RequestOptions,
  ): Promise<string> {
    opts ||= {};
    opts.headers = Object.assign(
      {
        'User-Agent': userAgent,
      },
      opts.headers,
    );
    return await request(method, url, data, opts);
  }

  /**
   * baseURL is the cloud functions endpoint. By default, this is the public
   * cloud functions endpoint, but it can be overridden for testing.
   */
  readonly #baseURL: string;

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

  constructor(opts?: CloudFunctionClientOptions) {
    this.#baseURL = opts?.baseURL || defaultBaseURL;

    this.#auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      credentials: opts?.credentials,
      projectId: opts?.projectID,
    });

    this.#projectID = opts?.projectID;
    this.#location = opts?.location;
  }

  async #request(
    method: string,
    url: string,
    data?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    opts?: RequestOptions,
  ) {
    const authToken = await this.#auth.getAccessToken();
    if (!authToken) {
      throw new Error(`Failed to get auth token for ${method} ${url}`);
    }

    opts ||= {};
    opts.headers = Object.assign(
      {
        'Authorization': `Bearer ${authToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      opts.headers,
    );

    try {
      const resp = await request(method, url, data, opts);
      return JSON.parse(resp);
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
  async #pollOperation(
    name: string,
    opts: PollOperationOptions = { interval: 5, retries: 60 },
  ): Promise<Operation> {
    const intervalMs: number = +opts.interval * 1000;

    for (let i = 0; i < opts.retries; i++) {
      // If a poll function was given, call it.
      if (opts.onPoll) opts.onPoll();

      const resp = await this.getOperation(name);
      if (resp.error) {
        throw new Error(`Operation failed: ${resp.error.message}`);
      }
      if (resp.done) {
        return resp;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Operation timed out`);
  }

  /**
   * getOperation fetches the operation by name.
   *
   * @param name Name of the operation, of the format `operations/{name}`.
   */
  async getOperation(name: string): Promise<Operation> {
    if (!name.startsWith('operations/')) {
      name = `operations/${name}`;
    }

    const u = `${this.#baseURL}/${name}`;
    const resp: Operation = await this.#request('GET', u);
    return resp;
  }

  /**
   * create creates a new Cloud Function.
   *
   * @param cf Cloud Function to deploy.
   */
  async create(
    cf: CloudFunction,
    opts?: CreateOptions,
  ): Promise<CloudFunctionResponse> {
    const timeout = opts?.timeout || defaultTimeout;

    const resourceName = this.fullResourceName(cf.name);
    cf.name = resourceName;

    const parent = this.parentFromName(resourceName);
    const u = `${this.#baseURL}/${parent}/functions`;
    const body = JSON.stringify(cf);
    const resp: Operation = await this.#request('POST', u, body);
    const op = await this.#pollOperation(resp.name, {
      interval: 5,
      retries: timeout / 5,
      onPoll: opts?.onPoll,
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
    const timeout = opts?.timeout || defaultTimeout;

    const resourceName = this.fullResourceName(name);
    const u = `${this.#baseURL}/${resourceName}`;
    const resp: Operation = await this.#request('DELETE', u);
    return await this.#pollOperation(resp.name, {
      interval: 5,
      retries: timeout / 5,
      onPoll: opts?.onPoll,
    });
  }

  /**
   * generateUploadURL generates a signed URL for which to upload the blob.
   *
   * @param parent Name of the location in which to deploy the function, of the
   * format `projects/p/locations/l`.
   */
  async generateUploadURL(parent: string): Promise<string> {
    const u = `${this.#baseURL}/${parent}/functions:generateUploadUrl`;
    const resp = await this.#request('POST', u);
    return resp.uploadUrl;
  }

  /**
   * get returns a function with the given name.
   *
   * @param name Name of the function to get, of the format
   * `projects/p/locations/l/functions/f`.
   */
  async get(name: string): Promise<CloudFunctionResponse> {
    const resourceName = this.fullResourceName(name);
    const u = `${this.#baseURL}/${resourceName}`;
    const resp: CloudFunctionResponse = await this.#request('GET', u);
    return resp;
  }

  /**
   * patch updates fields on the function.
   *
   * @param cf Cloud Function to patch
   */
  async patch(
    cf: CloudFunction,
    opts?: PatchOptions,
  ): Promise<CloudFunctionResponse> {
    const timeout = opts?.timeout || defaultTimeout;

    // fieldMasks are used if we are overwriting only specific fields of the
    // resource in the case we assume we will always need to replace.
    const updateMasks = [
      'sourceUploadUrl',
      'name',
      'environmentVariables',
      'buildEnvironmentVariables',
      'entryPoint',
      'runtime',
      'vpcConnector',
      'vpcConnectorEgressSettings',
      'ingressSettings',
      'serviceAccountEmail',
      'timeout',
      'minInstances',
      'maxInstances',
      'eventTrigger.eventType',
      'eventTrigger.resource',
      'eventTrigger.service',
      'labels',
      'secretEnvironmentVariables',
    ].join(',');

    const resourceName = this.fullResourceName(cf.name);
    cf.name = resourceName;

    const u = `${this.#baseURL}/${resourceName}?updateMask=${updateMasks}`;
    const body = JSON.stringify(cf);
    const resp: Operation = await this.#request('PATCH', u, body);
    const op = await this.#pollOperation(resp.name, {
      interval: 5,
      retries: timeout / 5,
      onPoll: opts?.onPoll,
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
    const timeout = opts?.timeout || defaultTimeout;

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
    let uploadURL;
    try {
      uploadURL = await this.generateUploadURL(parent);
      await this.uploadSource(uploadURL, zipPath);
    } catch (err) {
      throw new Error(`Failed to upload zip file: ${err}`);
    }

    // Delete temp zip file after upload
    removeFile(zipPath);
    cf.sourceUploadUrl = uploadURL;

    // Get the existing function data.
    const existingFunction = await (async (): Promise<CloudFunction | null> => {
      try {
        return await this.get(resourceName);
      } catch (err) {
        return null;
      }
    })();

    // If the function already exists, create a new version
    if (existingFunction) {
      if (opts?.onExisting) opts.onExisting();

      const resp: CloudFunctionResponse = await this.patch(cf, {
        timeout: timeout,
        onPoll: opts?.onPoll,
      });
      return resp;
    } else {
      if (opts?.onNew) opts.onNew();

      const resp: CloudFunctionResponse = await this.create(cf, {
        timeout: timeout,
        onPoll: opts?.onPoll,
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
      await CloudFunctionsClient.request('PUT', uploadURL, zipFile, {
        headers: {
          'content-type': 'application/zip',
          'x-goog-content-length-range': '0,104857600',
        },
      });
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
      throw new Error(
        `Failed to get project ID to build resource name. Try setting 'project_id'.`,
      );
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
}
