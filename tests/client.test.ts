/*
 * Copyright 2024 Google LLC
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

import { test } from 'node:test';
import assert from 'node:assert';

import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { skipIfMissingEnv } from '@google-github-actions/actions-utils';

import { CloudFunctionsClient, CloudFunction, Environment, IngressSettings } from '../src/client';
import { SecretName } from '../src/secret';
import { zipDir } from '../src/util';

const { TEST_PROJECT_ID, TEST_SERVICE_ACCOUNT_EMAIL, TEST_SECRET_VERSION_NAME } = process.env;
const TEST_LOCATION = 'us-central1';
const TEST_SEED = crypto.randomBytes(12).toString('hex').toLowerCase();
const TEST_SEED_UPPER = TEST_SEED.toUpperCase();
const TEST_FUNCTION_NAME = `unit-${TEST_SEED}`;

test(
  'lifecycle',
  {
    concurrency: true,
    skip: skipIfMissingEnv('TEST_AUTHENTICATED'),
  },
  async (suite) => {
    // Always try to delete the function
    suite.after(async function () {
      try {
        const client = new CloudFunctionsClient({
          projectID: TEST_PROJECT_ID,
          location: TEST_LOCATION,
        });

        await client.delete(TEST_FUNCTION_NAME);
      } catch {
        // do nothing
      }
    });

    await suite.test('can create, read, update, and delete', async () => {
      const secret = new SecretName(TEST_SECRET_VERSION_NAME);

      const client = new CloudFunctionsClient({
        projectID: TEST_PROJECT_ID,
        location: TEST_LOCATION,
      });

      const outputPath = path.join(os.tmpdir(), crypto.randomBytes(12).toString('hex'));
      const zipPath = await zipDir('tests/test-node-func', outputPath);

      // Generate upload URL
      const sourceUploadResp = await client.generateUploadURL(
        `projects/${TEST_PROJECT_ID}/locations/${TEST_LOCATION}`,
      );

      // Upload source
      await client.uploadSource(sourceUploadResp.uploadUrl, zipPath);

      const cf: CloudFunction = {
        name: TEST_FUNCTION_NAME,
        description: 'test function',
        environment: Environment.GEN_2,
        labels: {
          [`label1-${TEST_SEED}`]: `value1_${TEST_SEED}`,
          [`label2-${TEST_SEED}`]: `value2_${TEST_SEED}`,
        },

        buildConfig: {
          runtime: 'nodejs22',
          entryPoint: 'helloWorld',
          source: {
            storageSource: sourceUploadResp.storageSource,
          },
          environmentVariables: {
            [`BUILD_ENV_KEY1_${TEST_SEED_UPPER}`]: `VALUE1_${TEST_SEED}`,
            [`BUILD_ENV_KEY2_${TEST_SEED_UPPER}`]: `VALUE2_${TEST_SEED}`,
          },
        },

        serviceConfig: {
          allTrafficOnLatestRevision: true,
          availableCpu: '1',
          availableMemory: '512Mi',
          environmentVariables: {
            [`SERVICE_ENV_KEY1_${TEST_SEED_UPPER}`]: `VALUE1_${TEST_SEED}`,
            [`SERVICE_ENV_KEY2_${TEST_SEED_UPPER}`]: `VALUE2_${TEST_SEED}`,
          },
          ingressSettings: IngressSettings.ALLOW_ALL,
          maxInstanceCount: 5,
          minInstanceCount: 2,
          secretEnvironmentVariables: [
            {
              key: `SECRET1_${TEST_SEED_UPPER}`,
              projectId: secret.project,
              secret: secret.name,
              version: secret.version,
            },
          ],
          secretVolumes: [
            {
              mountPath: `/etc/secrets/one_${TEST_SEED}`,
              projectId: secret.project,
              secret: secret.name,
              versions: [
                {
                  path: 'value1',
                  version: secret.version,
                },
              ],
            },
          ],
          serviceAccountEmail: TEST_SERVICE_ACCOUNT_EMAIL,
          timeoutSeconds: 300,
        },
      };

      // Create
      const createResp = await client.create(cf, {
        onDebug: (f) => {
          process.stdout.write('\n\n\n\n');
          process.stdout.write(f());
          process.stdout.write('\n\n\n\n');
        },
      });
      assert.ok(createResp?.url);

      // Read
      const getResp = await client.get(cf.name);
      assert.ok(getResp.name.endsWith(TEST_FUNCTION_NAME)); // The response is the fully-qualified name
      assert.deepStrictEqual(getResp.description, 'test function');
      assert.deepStrictEqual(getResp.labels, {
        [`label1-${TEST_SEED}`]: `value1_${TEST_SEED}`,
        [`label2-${TEST_SEED}`]: `value2_${TEST_SEED}`,
      });
      assert.deepStrictEqual(getResp.buildConfig.runtime, 'nodejs22');
      assert.deepStrictEqual(getResp.buildConfig.environmentVariables, {
        [`BUILD_ENV_KEY1_${TEST_SEED_UPPER}`]: `VALUE1_${TEST_SEED}`,
        [`BUILD_ENV_KEY2_${TEST_SEED_UPPER}`]: `VALUE2_${TEST_SEED}`,
      });
      assert.deepStrictEqual(getResp.buildConfig.entryPoint, 'helloWorld');
      assert.deepStrictEqual(getResp.serviceConfig.availableCpu, '1');
      assert.deepStrictEqual(getResp.serviceConfig.availableMemory, '512Mi');
      assert.deepStrictEqual(getResp.serviceConfig.environmentVariables, {
        LOG_EXECUTION_ID: 'true', // inserted by GCP
        [`SERVICE_ENV_KEY1_${TEST_SEED_UPPER}`]: `VALUE1_${TEST_SEED}`,
        [`SERVICE_ENV_KEY2_${TEST_SEED_UPPER}`]: `VALUE2_${TEST_SEED}`,
      });
      assert.deepStrictEqual(getResp.serviceConfig.ingressSettings, 'ALLOW_ALL');
      assert.deepStrictEqual(getResp.serviceConfig.maxInstanceCount, 5);
      assert.deepStrictEqual(getResp.serviceConfig.minInstanceCount, 2);
      assert.deepStrictEqual(getResp.serviceConfig.secretEnvironmentVariables, [
        {
          key: `SECRET1_${TEST_SEED_UPPER}`,
          projectId: secret.project,
          secret: secret.name,
          version: secret.version,
        },
      ]);
      assert.deepStrictEqual(getResp.serviceConfig.secretVolumes, [
        {
          mountPath: `/etc/secrets/one_${TEST_SEED}`,
          projectId: secret.project,
          secret: secret.name,
          versions: [
            {
              path: 'value1',
              version: secret.version,
            },
          ],
        },
      ]);
      assert.deepStrictEqual(getResp.serviceConfig.serviceAccountEmail, TEST_SERVICE_ACCOUNT_EMAIL);
      assert.deepStrictEqual(getResp.serviceConfig.timeoutSeconds, 300);

      // Update
      const sourceUploadUpdateResp = await client.generateUploadURL(
        `projects/${TEST_PROJECT_ID}/locations/${TEST_LOCATION}`,
      );
      await client.uploadSource(sourceUploadUpdateResp.uploadUrl, zipPath);

      const cf2: CloudFunction = {
        name: TEST_FUNCTION_NAME,
        description: 'test function2',
        labels: {
          [`label3-${TEST_SEED}`]: `value3_${TEST_SEED}`,
          [`label4-${TEST_SEED}`]: `value4_${TEST_SEED}`,
        },

        buildConfig: {
          runtime: 'nodejs20',
          entryPoint: 'helloWorld',
          source: {
            storageSource: sourceUploadResp.storageSource,
          },
          environmentVariables: {
            [`BUILD_ENV_KEY3_${TEST_SEED_UPPER}`]: `VALUE3_${TEST_SEED}`,
            [`BUILD_ENV_KEY4_${TEST_SEED_UPPER}`]: `VALUE4_${TEST_SEED}`,
          },
        },

        serviceConfig: {
          allTrafficOnLatestRevision: true,
          availableMemory: '1Gi',
          environmentVariables: {
            [`SERVICE_ENV_KEY3_${TEST_SEED_UPPER}`]: `VALUE3_${TEST_SEED}`,
            [`SERVICE_ENV_KEY4_${TEST_SEED_UPPER}`]: `VALUE4_${TEST_SEED}`,
          },
          ingressSettings: IngressSettings.ALLOW_INTERNAL_AND_GCLB,
          maxInstanceCount: 3,
          minInstanceCount: 1,
          secretEnvironmentVariables: [
            {
              key: `SECRET2_${TEST_SEED_UPPER}`,
              projectId: secret.project,
              secret: secret.name,
              version: secret.version,
            },
          ],
          secretVolumes: [
            {
              mountPath: `/etc/secrets/two_${TEST_SEED}`,
              projectId: secret.project,
              secret: secret.name,
              versions: [
                {
                  path: 'value2',
                  version: secret.version,
                },
              ],
            },
          ],
          serviceAccountEmail: TEST_SERVICE_ACCOUNT_EMAIL,
          timeoutSeconds: 30,
        },
      };

      const patchResp = await client.patch(cf2, {
        onDebug: (f) => {
          process.stdout.write('\n\n\n\n');
          process.stdout.write(f());
          process.stdout.write('\n\n\n\n');
        },
      });
      assert.ok(patchResp.name.endsWith(TEST_FUNCTION_NAME)); // The response is the fully-qualified name
      assert.deepStrictEqual(patchResp.description, 'test function2');
      assert.deepStrictEqual(patchResp.labels, {
        [`label3-${TEST_SEED}`]: `value3_${TEST_SEED}`,
        [`label4-${TEST_SEED}`]: `value4_${TEST_SEED}`,
      });
      assert.deepStrictEqual(patchResp.buildConfig.runtime, 'nodejs20');
      assert.deepStrictEqual(patchResp.buildConfig.entryPoint, 'helloWorld');
      assert.deepStrictEqual(patchResp.buildConfig.environmentVariables, {
        [`BUILD_ENV_KEY3_${TEST_SEED_UPPER}`]: `VALUE3_${TEST_SEED}`,
        [`BUILD_ENV_KEY4_${TEST_SEED_UPPER}`]: `VALUE4_${TEST_SEED}`,
      });
      assert.deepStrictEqual(patchResp.serviceConfig.availableMemory, '1Gi');
      assert.deepStrictEqual(patchResp.serviceConfig.environmentVariables, {
        LOG_EXECUTION_ID: 'true', // inserted by GCP
        [`SERVICE_ENV_KEY3_${TEST_SEED_UPPER}`]: `VALUE3_${TEST_SEED}`,
        [`SERVICE_ENV_KEY4_${TEST_SEED_UPPER}`]: `VALUE4_${TEST_SEED}`,
      });
      assert.deepStrictEqual(patchResp.serviceConfig.ingressSettings, 'ALLOW_INTERNAL_AND_GCLB');
      assert.deepStrictEqual(patchResp.serviceConfig.maxInstanceCount, 3);
      assert.deepStrictEqual(patchResp.serviceConfig.minInstanceCount, 1);
      assert.deepStrictEqual(patchResp.serviceConfig.secretEnvironmentVariables, [
        {
          key: `SECRET2_${TEST_SEED_UPPER}`,
          projectId: secret.project,
          secret: secret.name,
          version: secret.version,
        },
      ]);
      assert.deepStrictEqual(patchResp.serviceConfig.secretVolumes, [
        {
          mountPath: `/etc/secrets/two_${TEST_SEED}`,
          projectId: secret.project,
          secret: secret.name,
          versions: [
            {
              path: 'value2',
              version: secret.version,
            },
          ],
        },
      ]);
      assert.deepStrictEqual(
        patchResp.serviceConfig.serviceAccountEmail,
        TEST_SERVICE_ACCOUNT_EMAIL,
      );
      assert.deepStrictEqual(patchResp.serviceConfig.timeoutSeconds, 30);

      // Delete
      const deleteResp = await client.delete(createResp.name);
      assert.ok(deleteResp.done);
    });
  },
);

test('#getSafe', { concurrency: true }, async (suite) => {
  await suite.test('does not error on a 404', async (t) => {
    t.mock.method(CloudFunctionsClient.prototype, 'get', () => {
      throw new Error(`
      {
        "error": {
          "code": 404,
          "message": "Function my-function does not exist",
          "status": "NOT_FOUND"
        }
      }
      `);
    });

    const client = new CloudFunctionsClient();
    const result = await client.getSafe('projects/p/functions/f');
    assert.deepStrictEqual(result, null);
  });

  await suite.test('errors on a 403', async (t) => {
    t.mock.method(CloudFunctionsClient.prototype, 'get', () => {
      throw new Error(`
      {
        "error": {
          "code": 403,
          "message": "Permission denied",
          "status": "PERMISSION_DENIED"
        }
      }
      `);
    });

    const client = new CloudFunctionsClient();
    await assert.rejects(async () => {
      await client.getSafe('projects/p/functions/f');
    }, 'failed to lookup existing function');
  });
});

test('#fullResourceName', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'empty name',
      client: new CloudFunctionsClient(),
      input: '',
      error: 'name cannot be empty',
    },
    {
      name: 'empty name spaces',
      client: new CloudFunctionsClient(),
      input: '  ',
      error: 'name cannot be empty',
    },
    {
      name: 'client missing project id',
      client: new CloudFunctionsClient({ projectID: '' }),
      input: 'f',
      error: 'Failed to get project ID to build resource name',
    },
    {
      name: 'client missing location',
      client: new CloudFunctionsClient({ projectID: 'p', location: '' }),
      input: 'f',
      error: 'Failed to get location',
    },
    {
      name: 'invalid resource name',
      client: new CloudFunctionsClient(),
      input: 'projects/foo',
      error: 'Invalid resource name',
    },
    {
      name: 'full resource name',
      client: new CloudFunctionsClient(),
      input: 'projects/p/locations/l/functions/f',
      expected: 'projects/p/locations/l/functions/f',
    },
    {
      name: 'builds location',
      client: new CloudFunctionsClient({ projectID: 'p', location: 'l' }),
      input: 'f',
      expected: 'projects/p/locations/l/functions/f',
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.expected) {
        const actual = tc.client.fullResourceName(tc.input);
        assert.deepStrictEqual(actual, tc.expected);
      } else if (tc.error) {
        assert.throws(() => {
          tc.client.fullResourceName(tc.input);
        }, new RegExp(tc.error));
      }
    });
  }
});

test('#parentFromName', { concurrency: true }, async (suite) => {
  const client = new CloudFunctionsClient();

  const cases = [
    {
      name: 'empty string',
      input: '',
      error: 'Invalid or missing name',
    },
    {
      name: 'not enough parts',
      input: 'foo/bar',
      error: 'Invalid or missing name',
    },
    {
      name: 'extracts parent',
      input: 'projects/p/locations/l/functions/f',
      expected: 'projects/p/locations/l',
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.expected) {
        const actual = client.parentFromName(tc.input);
        assert.deepStrictEqual(actual, tc.expected);
      } else if (tc.error) {
        assert.throws(() => {
          client.parentFromName(tc.input);
        }, new RegExp(tc.error));
      }
    });
  }
});
