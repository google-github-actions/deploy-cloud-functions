'use strict';

import 'mocha';
import { expect } from 'chai';

import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  CredentialBody,
  ExternalAccountClientOptions,
} from 'google-auth-library';

import { CloudFunctionsClient, CloudFunction } from '../src/client';
import { parseServiceAccountKeyJSON, zipDir } from '../src/util';

const testProjectID = process.env.DEPLOY_CF_PROJECT_ID;
const testServiceAccountKey = process.env.DEPLOY_CF_SA_KEY_JSON;
const testLocation = 'us-central1';
const testFunctionName = 'test-' + crypto.randomBytes(12).toString('hex');
const testNodeFuncDir = 'tests/test-node-func';

describe('CloudFunctionsClient', () => {
  describe('lifecycle', () => {
    // Always try to delete the function
    after(async function () {
      if (!testProjectID) return;

      const credentials = testServiceAccountKey
        ? parseServiceAccountKeyJSON(testServiceAccountKey)
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

      const credentials = testServiceAccountKey
        ? parseServiceAccountKeyJSON(testServiceAccountKey)
        : undefined;

      const client = new CloudFunctionsClient({
        projectID: testProjectID,
        location: testLocation,
        credentials: credentials,
      });

      const outputPath = path.join(
        os.tmpdir(),
        crypto.randomBytes(12).toString('hex'),
      );
      const zipPath = await zipDir(testNodeFuncDir, outputPath);

      // Generate upload URL
      const sourceURL = await client.generateUploadURL(
        `projects/${testProjectID}/locations/${testLocation}`,
      );

      // Upload source
      await client.uploadSource(sourceURL, zipPath);

      const cf: CloudFunction = {
        name: testFunctionName,
        runtime: 'nodejs12',
        environmentVariables: { KEY1: 'VALUE1' },
        entryPoint: 'helloWorld',
        availableMemoryMb: 512,
        sourceUploadUrl: sourceURL,
        httpsTrigger: {},
      };

      // Create
      const createResp = await client.create(cf);
      expect(createResp).to.be;
      expect(createResp.httpsTrigger?.url).to.be;

      // Read
      const getResp = await client.get(cf.name);
      expect(getResp).to.be;
      expect(getResp.entryPoint).to.eq('helloWorld');

      // Update
      cf.environmentVariables = { KEY2: 'VALUE2' };
      const patchResp = await client.patch(cf);
      expect(patchResp).to.be;
      expect(patchResp.environmentVariables).to.eql({ KEY2: 'VALUE2' });

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
