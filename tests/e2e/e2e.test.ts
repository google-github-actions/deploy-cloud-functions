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

import { test } from 'node:test';
import assert from 'node:assert';

import { skipIfMissingEnv } from '@google-github-actions/actions-utils';

import { GoogleAuth } from 'google-auth-library';

test(
  'e2e tests',
  {
    concurrency: true,
    skip: skipIfMissingEnv('URL'),
  },
  async (suite) => {
    await suite.test('makes a request', async () => {
      const url = process.env.URL!;

      // Requires ADC to be set
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(url);
      const response = await client.request({ url: url });
      assert.deepStrictEqual(response.status, 200);
      assert.match(response.data as string, /Hello World!/);
    });
  },
);
