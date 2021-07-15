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

import { cloudfunctions_v1 } from 'googleapis';
import fs from 'fs';
import YAML from 'yaml';

export type KVPair = {
  [key: string]: string;
};

/**
 * Available options to create the cloudFunction.
 *
 * @param name Name of the Cloud Function.
 * @param description Description for the Cloud Function.
 * @param sourceDir Path to function deployment directory within the source repo.
 * @param envVars List of key-value pairs to set as environment variables.
 * @param entryPoint Name of function to execute.
 * @param runtime Runtime to use for the function.
 * @param availableMemoryMb The amount of memory in MB available for a function.
 * @param vpcConnector The VPC Access connector that the function can connect to.
 * @param vpcConnectorEgressSettings The VPC Access connector egress settings.
 * @param parent Parent of the form projects/${projectId}/locations/${region}.
 * @param serviceAccountEmail The email address of the IAM service account associated with the function at runtime.
 * @param timeout The function execution timeout.
 * @param maxInstances Sets the maximum number of instances for the function.
 * @param eventTriggerType Specifies which action should trigger the function.
 * @param eventTriggerResource Specifies which resource from eventTrigger is observed.
 * @param eventTriggerService The hostname of the service that should be observed.
 * @param labels List of key-value pairs to set as function labels.
 */

export type CloudFunctionOptions = {
  name: string;
  description?: string;
  sourceDir?: string;
  envVars?: string;
  envVarsFile?: string;
  entryPoint?: string;
  runtime: string;
  availableMemoryMb?: number;
  vpcConnector?: string;
  vpcConnectorEgressSettings?: string;
  parent: string;
  serviceAccountEmail?: string;
  timeout?: string;
  maxInstances?: number;
  eventTriggerType?: string;
  eventTriggerResource?: string;
  eventTriggerService?: string;
  labels?: string;
};

/**
 * Construct a Cloud Function.
 *
 * @param opts CloudFunctionOptions.
 * @returns CloudFunction.
 */
export class CloudFunction {
  readonly request: cloudfunctions_v1.Schema$CloudFunction;
  readonly name: string;
  readonly sourceDir: string;
  readonly functionPath: string;
  constructor(opts: CloudFunctionOptions) {
    this.functionPath = `${opts.parent}/functions/${opts.name}`;

    const request: cloudfunctions_v1.Schema$CloudFunction = {
      name: this.functionPath,
      description: opts.description,
      entryPoint: opts.entryPoint,
      runtime: opts.runtime,
    };

    // Check if event trigger else set to http trigger
    if (opts.eventTriggerType && opts.eventTriggerResource) {
      request.eventTrigger = {};
      request.eventTrigger.eventType = opts.eventTriggerType;
      request.eventTrigger.resource = opts.eventTriggerResource;
      request.eventTrigger.service = opts.eventTriggerService;
    } else if (
      opts.eventTriggerType ||
      opts.eventTriggerResource ||
      opts.eventTriggerService
    ) {
      throw new TypeError(
        'For event triggered function, eventTriggerType and eventTriggerResource are required.',
      );
    } else {
      request.httpsTrigger = {};
    }

    // Set optionals
    request.serviceAccountEmail = opts?.serviceAccountEmail
      ? opts.serviceAccountEmail
      : null;
    request.vpcConnector = opts?.vpcConnector ? opts.vpcConnector : null;
    request.vpcConnectorEgressSettings = opts?.vpcConnectorEgressSettings
      ? opts.vpcConnectorEgressSettings
      : null;
    request.timeout = opts?.timeout ? `${opts.timeout}s` : null;
    request.maxInstances = opts?.maxInstances ? opts.maxInstances : null;
    request.availableMemoryMb = opts?.availableMemoryMb
      ? opts.availableMemoryMb
      : null;

    // Only one of  envVars and envVarsFile should be set
    if (opts?.envVars && opts?.envVarsFile) {
      throw new Error(
        'Only one of env_vars or env_vars_file can be specified.',
      );
    }

    // Parse env vars
    let envVars;
    if (opts?.envVars) {
      envVars = this.parseKVPairs(opts.envVars);
      request.environmentVariables = envVars;
    }
    if (opts?.envVarsFile) {
      envVars = this.parseEnvVarsFile(opts.envVarsFile);
      request.environmentVariables = envVars;
    }

    if (opts?.labels) {
      request.labels = this.parseKVPairs(opts.labels);
    }

    this.request = request;
    this.name = opts.name;
    this.sourceDir = opts.sourceDir ? opts.sourceDir : './';
  }

  /**
   * Set GCS Bucket URL.
   *
   * @param sourceUrl GCS URL where the source code was uploaded.
   */
  setSourceUrl(sourceUrl: string): void {
    this.request.sourceUploadUrl = sourceUrl;
  }

  /**
   * Parses a string of the format `KEY1=VALUE1,KEY2=VALUE2`.
   *
   * @param values String with key/value pairs to parse.
   * @returns map of type {KEY1:VALUE1}
   */
  protected parseKVPairs(values: string): KVPair {
    const valuePairs = values.split(',');
    const kvPairs: KVPair = {};
    valuePairs.forEach((pair) => {
      if (!pair.includes('=')) {
        throw new TypeError(
          `The expected data format should be "KEY1=VALUE1", got "${pair}" while parsing "${values}"`,
        );
      }
      const keyValue = pair.split('=');
      kvPairs[keyValue[0]] = keyValue[1];
    });
    return kvPairs;
  }

  /**
   * Read and parse an env var file.
   *
   * @param envVarsFile env var file path.
   * @returns map of type {KEY1:VALUE1}
   */
  protected parseEnvVarsFile(envVarFilePath: string): KVPair {
    const content = fs.readFileSync(envVarFilePath, 'utf-8');
    const yamlContent = YAML.parse(content) as KVPair;
    for (const [key, val] of Object.entries(yamlContent)) {
      if (typeof key !== 'string' || typeof val !== 'string') {
        throw new Error(
          `env_vars_file yaml must contain only key/value pair of strings. Error parsing key ${key} of type ${typeof key} with value ${val} of type ${typeof val}`,
        );
      }
    }
    return yamlContent;
  }
}
