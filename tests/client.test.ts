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

import { CloudFunctionsClient, CloudFunction } from '../src/client';
import { SecretName } from '../src/secret';
import { zipDir } from '../src/util';

const { TEST_PROJECT_ID, TEST_SERVICE_ACCOUNT_EMAIL, TEST_SECRET_VERSION_NAME } = process.env;
const TEST_LOCATION = 'us-central1';
const TEST_FUNCTION_NAME = 'test-' + crypto.randomBytes(12).toString('hex');

test(
  'lifecycle',
  {
    concurrency: true,
    skip: skipIfMissingEnv('TEST_PROJECT_ID', 'TEST_LOCATION'),
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

    suite.test('can create, read, update, and delete', async () => {
      const secret = new SecretName(TEST_SECRET_VERSION_NAME);

      const client = new CloudFunctionsClient({
        projectID: TEST_PROJECT_ID,
        location: TEST_LOCATION,
      });

      const outputPath = path.join(os.tmpdir(), crypto.randomBytes(12).toString('hex'));
      const zipPath = await zipDir('tests/test-node-func', outputPath);

      // Generate upload URL
      const sourceURL = await client.generateUploadURL(
        `projects/${TEST_PROJECT_ID}/locations/${TEST_LOCATION}`,
      );

      // Upload source
      await client.uploadSource(sourceURL, zipPath);

      const cf: CloudFunction = {
        name: TEST_FUNCTION_NAME,
        runtime: 'nodejs20',
        description: 'test function',
        availableMemoryMb: 512,
        buildEnvironmentVariables: { BUILDKEY1: 'VALUE1', BUILDKEY2: 'VALUE2' },
        // buildWorkerPool: string,
        dockerRegistry: 'ARTIFACT_REGISTRY',
        // dockerRepository: string,
        entryPoint: 'helloWorld',
        environmentVariables: { KEY1: 'VALUE1', KEY2: 'VALUE2' },
        ingressSettings: 'ALLOW_ALL',
        // kmsKeyName: string,
        labels: { key1: 'value1', key2: 'value2' },
        maxInstances: 5,
        minInstances: 2,
        // network: string,
        secretEnvironmentVariables: [
          {
            key: 'SECRET1',
            projectId: secret.project,
            secret: secret.name,
            version: secret.version,
          },
        ],
        secretVolumes: [
          {
            mountPath: '/etc/secrets/one',
            projectId: secret.project,
            secret: secret.name,
            versions: [
              {
                path: '/value1',
                version: secret.version,
              },
            ],
          },
        ],
        serviceAccountEmail: TEST_SERVICE_ACCOUNT_EMAIL,
        timeout: '60s',
        // vpcConnector: string,
        // vpcConnectorEgressSettings: string,

        sourceUploadUrl: sourceURL,
        httpsTrigger: {
          securityLevel: 'SECURE_ALWAYS',
        },
      };

      // Create
      const createResp = await client.create(cf);
      assert.ok(createResp?.httpsTrigger?.url);

      // Read
      const getResp = await client.get(cf.name);
      assert.ok(getResp.name.endsWith(TEST_FUNCTION_NAME)); // The response is the fully-qualified name
      assert.deepStrictEqual(getResp.runtime, 'nodejs20');
      assert.deepStrictEqual(getResp.description, 'test function');
      assert.deepStrictEqual(getResp.availableMemoryMb, 512);
      assert.deepStrictEqual(getResp.buildEnvironmentVariables, {
        BUILDKEY1: 'VALUE1',
        BUILDKEY2: 'VALUE2',
      });
      assert.deepStrictEqual(getResp.entryPoint, 'helloWorld');
      assert.deepStrictEqual(getResp.environmentVariables, { KEY1: 'VALUE1', KEY2: 'VALUE2' });
      assert.deepStrictEqual(getResp.ingressSettings, 'ALLOW_ALL');
      assert.deepStrictEqual(getResp.labels, { key1: 'value1', key2: 'value2' });
      assert.deepStrictEqual(getResp.maxInstances, 5);
      assert.deepStrictEqual(getResp.minInstances, 2);
      assert.deepStrictEqual(getResp.secretEnvironmentVariables, [
        {
          key: 'SECRET1',
          projectId: secret.project,
          secret: secret.name,
          version: secret.version,
        },
      ]);
      assert.deepStrictEqual(getResp.secretVolumes, [
        {
          mountPath: '/etc/secrets/one',
          projectId: secret.project,
          secret: secret.name,
          versions: [
            {
              path: '/value1',
              version: secret.version,
            },
          ],
        },
      ]);
      assert.deepStrictEqual(getResp.serviceAccountEmail, TEST_SERVICE_ACCOUNT_EMAIL);
      assert.deepStrictEqual(getResp.timeout, '60s');
      assert.deepStrictEqual(getResp.httpsTrigger?.securityLevel, 'SECURE_ALWAYS');

      // Update
      const updateSourceUrl = await client.generateUploadURL(
        `projects/${TEST_PROJECT_ID}/locations/${TEST_LOCATION}`,
      );
      await client.uploadSource(updateSourceUrl, zipPath);

      const cf2: CloudFunction = {
        name: TEST_FUNCTION_NAME,
        runtime: 'nodejs14',
        description: 'test function2',
        availableMemoryMb: 256,
        buildEnvironmentVariables: { BUILDKEY3: 'VALUE3', BUILDKEY4: 'VALUE4' },
        // buildWorkerPool: string,
        dockerRegistry: 'CONTAINER_REGISTRY',
        // dockerRepository: string,
        entryPoint: 'helloWorld',
        environmentVariables: { KEY3: 'VALUE3', KEY4: 'VALUE4' },
        ingressSettings: 'ALLOW_INTERNAL_AND_GCLB',
        // kmsKeyName: string,
        labels: { key3: 'value3', key4: 'value4' },
        maxInstances: 3,
        minInstances: 1,
        // network: string,
        secretEnvironmentVariables: [
          {
            key: 'SECRET2',
            projectId: secret.project,
            secret: secret.name,
            version: secret.version,
          },
        ],
        secretVolumes: [
          {
            mountPath: '/etc/secrets/two',
            projectId: secret.project,
            secret: secret.name,
            versions: [
              {
                path: '/value2',
                version: secret.version,
              },
            ],
          },
        ],
        serviceAccountEmail: TEST_SERVICE_ACCOUNT_EMAIL,
        timeout: '30s',
        // vpcConnector: string,
        // vpcConnectorEgressSettings: string,

        sourceUploadUrl: updateSourceUrl,
        httpsTrigger: {
          securityLevel: 'SECURE_OPTIONAL',
        },
      };

      const patchResp = await client.patch(cf2);
      assert.ok(patchResp.name.endsWith(TEST_FUNCTION_NAME)); // The response is the fully-qualified name
      assert.deepStrictEqual(patchResp.runtime, 'nodejs14');
      assert.deepStrictEqual(patchResp.description, 'test function2');
      assert.deepStrictEqual(patchResp.availableMemoryMb, 256);
      assert.deepStrictEqual(patchResp.buildEnvironmentVariables, {
        BUILDKEY3: 'VALUE3',
        BUILDKEY4: 'VALUE4',
      });
      assert.deepStrictEqual(patchResp.entryPoint, 'helloWorld');
      assert.deepStrictEqual(patchResp.environmentVariables, { KEY3: 'VALUE3', KEY4: 'VALUE4' });
      assert.deepStrictEqual(patchResp.ingressSettings, 'ALLOW_INTERNAL_AND_GCLB');
      assert.deepStrictEqual(patchResp.labels, { key3: 'value3', key4: 'value4' });
      assert.deepStrictEqual(patchResp.maxInstances, 3);
      assert.deepStrictEqual(patchResp.minInstances, 1);
      assert.deepStrictEqual(patchResp.secretEnvironmentVariables, [
        {
          key: 'SECRET2',
          projectId: secret.project,
          secret: secret.name,
          version: secret.version,
        },
      ]);
      assert.deepStrictEqual(patchResp.secretVolumes, [
        {
          mountPath: '/etc/secrets/two',
          projectId: secret.project,
          secret: secret.name,
          versions: [
            {
              path: '/value2',
              version: secret.version,
            },
          ],
        },
      ]);
      assert.deepStrictEqual(patchResp.serviceAccountEmail, TEST_SERVICE_ACCOUNT_EMAIL);
      assert.deepStrictEqual(patchResp.timeout, '30s');
      assert.deepStrictEqual(patchResp.httpsTrigger?.securityLevel, 'SECURE_OPTIONAL');

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
