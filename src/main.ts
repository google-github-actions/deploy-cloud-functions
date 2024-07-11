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

import { EntryData } from 'archiver';
import {
  debug as logDebug,
  getInput,
  info as logInfo,
  isDebug,
  setFailed,
  setOutput,
} from '@actions/core';
import {
  errorMessage,
  parseBoolean,
  parseDuration,
  parseKVString,
  presence,
  toEnum,
} from '@google-github-actions/actions-utils';

import {
  CloudFunction,
  CloudFunctionsClient,
  Environment,
  IngressSettings,
  RetryPolicy,
  VpcConnectorEgressSettings,
} from './client';
import { formatEntry, parseEventTriggerFilters, parseSecrets, stringToInt } from './util';

async function run() {
  try {
    // Google Cloud inputs
    const projectID = presence(getInput('project_id')) || presence(process.env?.GCLOUD_PROJECT);
    const region = presence(getInput('region')) || 'us-central1';
    const universe = getInput('universe') || 'googleapis.com';

    // top-level inputs
    const name = getInput('name', { required: true });
    const description = presence(getInput('description'));
    const environment = toEnum(Environment, getInput('environment') || Environment.GEN_2);
    const kmsKeyName = presence(getInput('kms_key_name'));
    const labels = parseKVString(getInput('labels'));
    const sourceDir = presence(getInput('source_dir')) || process.cwd();

    // buildConfig
    const runtime = getInput('runtime', { required: true });
    const buildEnvironmentVariables = parseKVString(getInput('build_environment_variables'));
    const buildServiceAccount = presence(getInput('build_service_account'));
    const buildWorkerPool = presence(getInput('build_worker_pool'));
    const dockerRepository = presence(getInput('docker_repository'));
    const entryPoint = presence(getInput('entry_point'));

    // serviceConfig
    const allTrafficOnLatestRevision = parseBoolean(
      getInput('all_traffic_on_latest_revision'),
      true,
    );
    const availableCpu = presence(getInput('cpu'));
    const availableMemory = presence(getInput('memory')) || '256Mi';
    const environmentVariables = parseKVString(getInput('environment_variables'));
    const ingressSettings = toEnum(
      IngressSettings,
      getInput('ingress_settings') || IngressSettings.ALLOW_ALL,
    );
    const maxInstanceCount = presence(getInput('max_instance_count'));
    const maxInstanceRequestConcurrency = stringToInt(getInput('max_instance_request_concurrency'));
    const minInstanceCount = presence(getInput('min_instance_count'));
    const [secretEnvironmentVariables, secretVolumes] = parseSecrets(getInput('secrets'));
    const serviceAccount = presence(getInput('service_account'));
    const serviceTimeout = parseDuration(getInput('service_timeout'));
    const vpcConnector = presence(getInput('vpc_connector'));
    const vpcConnectorEgressSettings = toEnum(
      VpcConnectorEgressSettings,
      getInput('vpc_connector_egress_settings') || VpcConnectorEgressSettings.PRIVATE_RANGES_ONLY,
    );

    // eventTrigger
    const eventTriggerLocation = presence(getInput('event_trigger_location'));
    const eventTriggerType = presence(getInput('event_trigger_type'));
    const eventTriggerFilters = parseEventTriggerFilters(getInput('event_trigger_filters'));
    const eventTriggerPubSubTopic = presence(getInput('event_trigger_pubsub_topic'));
    const eventTriggerServiceAccount = presence(getInput('event_trigger_service_account'));
    const eventTriggerRetryPolicy = parseBoolean(getInput('event_trigger_retry'), true)
      ? RetryPolicy.RETRY_POLICY_RETRY
      : RetryPolicy.RETRY_POLICY_DO_NOT_RETRY;
    const eventTriggerChannel = presence(getInput('event_trigger_channel'));

    // Validation
    if (serviceTimeout <= 0) {
      throw new Error(
        `The 'service_timeout' parameter must be > 0 seconds (got ${serviceTimeout})`,
      );
    }

    // Create Cloud Functions client
    const client = new CloudFunctionsClient({
      projectID: projectID,
      location: region,
      universe: universe,
    });

    // Create Function definition
    const cf: CloudFunction = {
      name: name,
      description: description,
      environment: environment,
      kmsKeyName: kmsKeyName,
      labels: labels,

      buildConfig: {
        runtime: runtime,
        entryPoint: entryPoint,
        dockerRepository: dockerRepository,
        environmentVariables: buildEnvironmentVariables,
        serviceAccount: buildServiceAccount,
        workerPool: buildWorkerPool,
      },

      serviceConfig: {
        allTrafficOnLatestRevision: allTrafficOnLatestRevision,
        availableCpu: availableCpu,
        availableMemory: availableMemory,
        environmentVariables: environmentVariables,
        ingressSettings: ingressSettings,
        maxInstanceCount: maxInstanceCount ? +maxInstanceCount : undefined,
        maxInstanceRequestConcurrency: maxInstanceRequestConcurrency,
        minInstanceCount: minInstanceCount ? +minInstanceCount : undefined,
        secretEnvironmentVariables: secretEnvironmentVariables,
        secretVolumes: secretVolumes,
        serviceAccountEmail: serviceAccount,
        timeoutSeconds: serviceTimeout,
        vpcConnector: vpcConnector,
        vpcConnectorEgressSettings: vpcConnectorEgressSettings,
      },

      eventTrigger: {
        triggerRegion: eventTriggerLocation,
        eventType: eventTriggerType,
        eventFilters: eventTriggerFilters,
        pubsubTopic: eventTriggerPubSubTopic,
        serviceAccountEmail: eventTriggerServiceAccount,
        retryPolicy: eventTriggerRetryPolicy,
        channel: eventTriggerChannel,
      },
    };

    // Ensure eventTrigger isn't set if no eventTrigger was given
    if (!cf.eventTrigger?.eventType) {
      delete cf.eventTrigger;
    }

    // Ensure vpcConnectorEgressSettings isn't set if no vpcConnector was given
    if (!cf.serviceConfig?.vpcConnector) {
      delete cf.serviceConfig?.vpcConnectorEgressSettings;
    }

    if (isDebug()) {
      const definition = JSON.stringify(cf, null, 2);
      logDebug(`Compiled Cloud Function definition: ${definition}`);
    }

    // Deploy the Cloud Function
    const resp = await client.deployFromLocalSource(cf, sourceDir, {
      onZip: (sourceDir: string, zipPath: string) => {
        logInfo(`Created zip file from '${sourceDir}' at '${zipPath}'`);
      },
      onZipAddEntry: (entry: EntryData) => {
        logDebug(formatEntry(entry));
      },
      onZipIgnoreEntry: (entry: EntryData) => {
        logDebug(`Ignoring ${entry.name}`);
      },
      onNew: () => {
        logInfo('Creating new Cloud Functions deployment');
      },
      onExisting: () => {
        logInfo('Updating existing Cloud Functions deployment');
      },
      onPoll: ((): (() => void) => {
        let iteration = 0;
        return () => {
          if (iteration === 0) {
            process.stdout.write(`Deploying Cloud Function...`);
          } else {
            process.stdout.write(`.`);
          }
          iteration++;
        };
      })(),
    });

    if (resp.state !== 'ACTIVE') {
      throw new Error(
        `Cloud Function deployment finished, but the function not in the ` +
          `"ACTIVE" status. The current status is "${resp.state}", which ` +
          `could indicate a failed deployment. Check the Cloud Function ` +
          `logs for more information.`,
      );
    }

    setOutput('name', resp.name);
    setOutput('url', resp.url);
  } catch (err) {
    const msg = errorMessage(err);
    setFailed(`google-github-actions/deploy-cloud-functions failed with: ${msg}`);
  }
}

if (require.main === module) {
  run();
}
