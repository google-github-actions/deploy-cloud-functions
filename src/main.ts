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

import { posix } from 'path';

import { EntryData } from 'archiver';
import {
  debug as logDebug,
  getBooleanInput,
  getInput,
  info as logInfo,
  setFailed,
  setOutput,
  warning as logWarning,
} from '@actions/core';
import {
  Credential,
  errorMessage,
  isServiceAccountKey,
  parseCredential,
  parseDuration,
  parseKVString,
  parseKVStringAndFile,
  presence,
} from '@google-github-actions/actions-utils';

import { CloudFunction, CloudFunctionsClient, SecretEnvVar, SecretVolume } from './client';
import { SecretName } from './secret';
import { formatEntry, toEnum } from './util';

async function run(): Promise<void> {
  try {
    // Get inputs
    const name = getInput('name', { required: true });
    const runtime = getInput('runtime', { required: true });
    const description = presence(getInput('description'));
    const credentials = presence(getInput('credentials'));
    let projectID = presence(getInput('project_id'));
    const availableMemoryMb = presence(getInput('memory_mb'));
    const region = presence(getInput('region') || 'us-central1');
    const envVars = presence(getInput('env_vars'));
    const envVarsFile = presence(getInput('env_vars_file'));
    const entryPoint = presence(getInput('entry_point'));
    const sourceDir = presence(getInput('source_dir'));
    const vpcConnector = presence(getInput('vpc_connector'));
    const vpcConnectorEgressSettings = presence(getInput('vpc_connector_egress_settings'));
    const ingressSettings = presence(getInput('ingress_settings'));
    const serviceAccountEmail = presence(getInput('service_account_email'));
    const timeout = parseDuration(getInput('timeout'));
    const maxInstances = presence(getInput('max_instances'));
    const minInstances = presence(getInput('min_instances'));
    const httpsTriggerSecurityLevel = presence(getInput('https_trigger_security_level'));
    const eventTriggerType = presence(getInput('event_trigger_type'));
    const eventTriggerResource = presence(getInput('event_trigger_resource'));
    const eventTriggerService = presence(getInput('event_trigger_service'));
    const eventTriggerRetry = getBooleanInput('event_trigger_retry');
    const deployTimeout = presence(getInput('deploy_timeout'));
    const labels = parseKVString(getInput('labels'));

    const buildEnvVars = presence(getInput('build_environment_variables'));
    const buildEnvVarsFile = presence(getInput('build_environment_variables_file'));
    const buildWorkerPool = presence(getInput('build_worker_pool'));

    const secretEnvVars = parseKVString(getInput('secret_environment_variables'));
    const secretVols = parseKVString(getInput('secret_volumes'));

    const dockerRegistry = presence(toEnum(getInput('docker_registry')));
    const dockerRepository = presence(getInput('docker_repository'));
    const kmsKeyName = presence(getInput('kms_key_name'));

    // Add warning if using credentials
    let credentialsJSON: Credential | undefined;
    if (credentials) {
      logWarning(
        'The "credentials" input is deprecated. ' +
          'Please switch to using google-github-actions/auth which supports both Workload Identity Federation and JSON Key authentication. ' +
          'For more details, see https://github.com/google-github-actions/deploy-cloud-functions#authorization',
      );

      credentialsJSON = parseCredential(credentials);
    }

    // Pick the best project ID.
    if (!projectID) {
      if (credentialsJSON && isServiceAccountKey(credentialsJSON)) {
        projectID = credentialsJSON?.project_id;
        logInfo(`Extracted project ID '${projectID}' from credentials JSON`);
      } else if (process.env?.GCLOUD_PROJECT) {
        projectID = process.env.GCLOUD_PROJECT;
        logInfo(`Extracted project ID '${projectID}' from $GCLOUD_PROJECT`);
      }
    }

    // Validation
    if (
      httpsTriggerSecurityLevel &&
      httpsTriggerSecurityLevel.toUpperCase() != 'SECURITY_LEVEL_UNSPECIFIED' &&
      eventTriggerType
    ) {
      throw new Error(
        `Only one of 'https_trigger_security_level' or 'event_trigger_type' ` + `may be specified.`,
      );
    }
    if (!sourceDir) {
      // Note: this validation will need to go away once we support deploying
      // from a docker repo.
      throw new Error(`Missing required value 'source_dir'`);
    }
    if (dockerRepository || kmsKeyName) {
      if (!dockerRepository) {
        throw new Error(
          `Missing required field 'docker_repository'. This is required when ` +
            `'kms_key_name' is set.`,
        );
      }
      if (!kmsKeyName) {
        throw new Error(
          `Missing required field 'kms_key_name'. This is required when ` +
            `'docker_repository' is set.`,
        );
      }
    }
    if (timeout <= 0) {
      throw new Error(`The 'timeout' parameter must be > 0 seconds (got ${timeout})`);
    }

    // Build environment variables.
    const buildEnvironmentVariables = parseKVStringAndFile(buildEnvVars, buildEnvVarsFile);
    const environmentVariables = parseKVStringAndFile(envVars, envVarsFile);

    // Build secret environment variables.
    const secretEnvironmentVariables: SecretEnvVar[] = [];
    if (secretEnvVars) {
      for (const [key, value] of Object.entries(secretEnvVars)) {
        const secretRef = new SecretName(value);
        secretEnvironmentVariables.push({
          key: key,
          projectId: secretRef.project,
          secret: secretRef.name,
          version: secretRef.version,
        });
      }
    }

    // Build secret volumes.
    const secretVolumes: SecretVolume[] = [];
    if (secretVols) {
      for (const [key, value] of Object.entries(secretVols)) {
        const mountPath = posix.dirname(key);
        const pth = posix.basename(key);

        const secretRef = new SecretName(value);
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
      }
    }

    // Create Cloud Functions client
    const client = new CloudFunctionsClient({
      projectID: projectID,
      location: region,
      credentials: credentialsJSON,
    });

    // Create Function definition
    const cf: CloudFunction = {
      name: name,
      runtime: runtime,
      description: description,
      availableMemoryMb: availableMemoryMb ? +availableMemoryMb : undefined,
      buildEnvironmentVariables: buildEnvironmentVariables,
      buildWorkerPool: buildWorkerPool,
      dockerRegistry: dockerRegistry,
      dockerRepository: dockerRepository,
      entryPoint: entryPoint,
      environmentVariables: environmentVariables,
      ingressSettings: ingressSettings,
      kmsKeyName: kmsKeyName,
      labels: labels,
      maxInstances: maxInstances ? +maxInstances : undefined,
      minInstances: minInstances ? +minInstances : undefined,
      secretEnvironmentVariables: secretEnvironmentVariables,
      secretVolumes: secretVolumes,
      serviceAccountEmail: serviceAccountEmail,
      timeout: `${timeout}s`,
      vpcConnector: vpcConnector,
      vpcConnectorEgressSettings: vpcConnectorEgressSettings,
    };

    if (eventTriggerType && eventTriggerResource) {
      // Set event trigger properties.
      cf.eventTrigger = {
        eventType: eventTriggerType,
        resource: eventTriggerResource,
        service: eventTriggerService,
      };

      if (eventTriggerRetry) {
        cf.eventTrigger.failurePolicy = {
          // No, there's no value here. Retry is a oneof, and this is the
          // translation to javascript.
          retry: {},
        };
      }
    } else if (eventTriggerType || eventTriggerResource || eventTriggerService) {
      throw new Error(
        `Event triggered functions must define 'event_trigger_type' and 'event_trigger_resource'`,
      );
    } else {
      // Set https trigger properties.
      cf.httpsTrigger = {};

      if (httpsTriggerSecurityLevel) {
        cf.httpsTrigger.securityLevel = httpsTriggerSecurityLevel.toUpperCase();
      }
    }

    // Deploy the Cloud Function
    const resp = await client.deployFromLocalSource(cf, sourceDir, {
      timeout: deployTimeout ? +deployTimeout : undefined,
      onZip: (sourceDir: string, zipPath: string) => {
        logInfo(`Created zip file from '${sourceDir}' at '${zipPath}'`);
      },
      onZipEntry: (entry: EntryData) => {
        logDebug(formatEntry(entry));
      },
      onNew: () => {
        logInfo('Creating new Cloud Function deployment');
      },
      onExisting: () => {
        logInfo('Creating new Cloud Function revision');
      },
      onPoll: ((): (() => void) => {
        let iteration = 0;
        return () => {
          if (iteration === 0) {
            logInfo('Deploying Cloud Function');
          } else {
            logInfo(`Still deploying Cloud Function (${iteration}/n)`);
          }
          iteration++;
        };
      })(),
    });

    if (resp.status !== 'ACTIVE') {
      throw new Error(
        `Cloud Function deployment finished, but the function not in the ` +
          `"ACTIVE" status. The current status is "${resp.status}", which ` +
          `could indicate a failed deployment. Check the Cloud Function ` +
          `logs for more information.`,
      );
    }

    if (resp.httpsTrigger?.url) {
      setOutput('url', resp.httpsTrigger.url);
    } else {
      logWarning(
        `Output 'url' was not set - only httpsTrigger Cloud Functions return this attribute.`,
      );
    }

    setOutput('id', resp.name);
    setOutput('status', resp.status);
    setOutput('version', resp.versionId);
    setOutput('runtime', resp.runtime);
  } catch (err) {
    const msg = errorMessage(err);
    setFailed(`google-github-actions/deploy-cloud-functions failed with: ${msg}`);
  }
}

run();
