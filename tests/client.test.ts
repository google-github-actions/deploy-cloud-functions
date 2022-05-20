'use strict';

import 'mocha';
import { expect } from 'chai';

import os from 'os';
import path from 'path';
import crypto from 'crypto';

import { parseCredential } from '@google-github-actions/actions-utils';

import { CloudFunctionsClient, CloudFunction } from '../src/client';
import { SecretName } from '../src/secret';
import { zipDir } from '../src/util';

const testProjectID = process.env.DEPLOY_CF_PROJECT_ID;
const testServiceAccountKey = process.env.DEPLOY_CF_SA_KEY_JSON;
const testServiceAccountEmail = process.env.DEPLOY_CF_SA_EMAIL;
const testSecretVersion = process.env.DEPLOY_CF_SECRET_VERSION_REF;
const testLocation = 'us-central1';
const testFunctionName = 'test-' + crypto.randomBytes(12).toString('hex');
const testNodeFuncDir = 'tests/test-node-func';

describe('CloudFunctionsClient', () => {
  describe('lifecycle', () => {
    // Always try to delete the function
    after(async function () {
      if (!testProjectID) return;

      const credentials = testServiceAccountKey
        ? parseCredential(testServiceAccountKey)
        : undefined;

      try {
        const client = new CloudFunctionsClient({
          projectID: testProjectID,
          location: testLocation,
          credentials: credentials,
        });

        await client.delete(testFunctionName);
      } catch {
        // do nothing
      }
    });

    it('can create, read, update, and delete', async function () {
      if (!testProjectID) this.skip();

      const secret = new SecretName(testSecretVersion);

      const credentials = testServiceAccountKey
        ? parseCredential(testServiceAccountKey)
        : undefined;

      const client = new CloudFunctionsClient({
        projectID: testProjectID,
        location: testLocation,
        credentials: credentials,
      });

      const outputPath = path.join(os.tmpdir(), crypto.randomBytes(12).toString('hex'));
      const zipPath = await zipDir(testNodeFuncDir, outputPath);

      // Generate upload URL
      const sourceURL = await client.generateUploadURL(
        `projects/${testProjectID}/locations/${testLocation}`,
      );

      // Upload source
      await client.uploadSource(sourceURL, zipPath);

      const cf: CloudFunction = {
        name: testFunctionName,
        runtime: 'nodejs16',
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
        serviceAccountEmail: testServiceAccountEmail,
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
      expect(createResp).to.be;
      expect(createResp.httpsTrigger?.url).to.be;

      // Read
      const getResp = await client.get(cf.name);
      expect(getResp.name).to.satisfy((msg: string) => msg.endsWith(testFunctionName)); // The response is the fully-qualified name
      expect(getResp.runtime).to.eql('nodejs16');
      expect(getResp.description).to.eql('test function');
      expect(getResp.availableMemoryMb).to.eql(512);
      expect(getResp.buildEnvironmentVariables).to.eql({
        BUILDKEY1: 'VALUE1',
        BUILDKEY2: 'VALUE2',
      });
      expect(getResp.entryPoint).to.eql('helloWorld');
      expect(getResp.environmentVariables).to.eql({ KEY1: 'VALUE1', KEY2: 'VALUE2' });
      expect(getResp.ingressSettings).to.eql('ALLOW_ALL');
      expect(getResp.labels).to.eql({ key1: 'value1', key2: 'value2' });
      expect(getResp.maxInstances).to.eql(5);
      expect(getResp.minInstances).to.eql(2);
      expect(getResp.secretEnvironmentVariables).to.eql([
        {
          key: 'SECRET1',
          projectId: secret.project,
          secret: secret.name,
          version: secret.version,
        },
      ]);
      expect(getResp.secretVolumes).to.eql([
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
      expect(getResp.serviceAccountEmail).to.eql(testServiceAccountEmail);
      expect(getResp.timeout).to.eql('60s');
      expect(getResp.httpsTrigger?.securityLevel).to.eql('SECURE_ALWAYS');

      // Update
      const updateSourceUrl = await client.generateUploadURL(
        `projects/${testProjectID}/locations/${testLocation}`,
      );
      await client.uploadSource(updateSourceUrl, zipPath);

      const cf2: CloudFunction = {
        name: testFunctionName,
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
        serviceAccountEmail: testServiceAccountEmail,
        timeout: '30s',
        // vpcConnector: string,
        // vpcConnectorEgressSettings: string,

        sourceUploadUrl: updateSourceUrl,
        httpsTrigger: {
          securityLevel: 'SECURE_OPTIONAL',
        },
      };

      const patchResp = await client.patch(cf2);
      expect(patchResp.name).to.satisfy((msg: string) => msg.endsWith(testFunctionName)); // The response is the fully-qualified name
      expect(patchResp.runtime).to.eql('nodejs14');
      expect(patchResp.description).to.eql('test function2');
      expect(patchResp.availableMemoryMb).to.eql(256);
      expect(patchResp.buildEnvironmentVariables).to.eql({
        BUILDKEY3: 'VALUE3',
        BUILDKEY4: 'VALUE4',
      });
      expect(patchResp.entryPoint).to.eql('helloWorld');
      expect(patchResp.environmentVariables).to.eql({ KEY3: 'VALUE3', KEY4: 'VALUE4' });
      expect(patchResp.ingressSettings).to.eql('ALLOW_INTERNAL_AND_GCLB');
      expect(patchResp.labels).to.eql({ key3: 'value3', key4: 'value4' });
      expect(patchResp.maxInstances).to.eql(3);
      expect(patchResp.minInstances).to.eql(1);
      expect(patchResp.secretEnvironmentVariables).to.eql([
        {
          key: 'SECRET2',
          projectId: secret.project,
          secret: secret.name,
          version: secret.version,
        },
      ]);
      expect(patchResp.secretVolumes).to.eql([
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
      expect(patchResp.serviceAccountEmail).to.eql(testServiceAccountEmail);
      expect(patchResp.timeout).to.eql('30s');
      expect(patchResp.httpsTrigger?.securityLevel).to.eql('SECURE_OPTIONAL');

      // Delete
      const deleteResp = await client.delete(createResp.name);
      expect(deleteResp.done).to.be.true;
    });
  });

  describe('#fullResourceName', () => {
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
        error: 'Failed to get location (region) to build resource name',
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

    cases.forEach((tc) => {
      it(tc.name, async () => {
        if (tc.expected) {
          expect(tc.client.fullResourceName(tc.input)).to.eql(tc.expected);
        } else if (tc.error) {
          expect(() => {
            tc.client.fullResourceName(tc.input);
          }).to.throw(tc.error);
        }
      });
    });
  });

  describe('#parentFromName', () => {
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

    cases.forEach((tc) => {
      it(tc.name, async () => {
        if (tc.expected) {
          expect(client.parentFromName(tc.input)).to.eql(tc.expected);
        } else if (tc.error) {
          expect(() => {
            client.parentFromName(tc.input);
          }).to.throw(tc.error);
        }
      });
    });
  });
});
