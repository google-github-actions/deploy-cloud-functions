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

import { expect } from 'chai';
import { CloudFunctionsClient } from '../../src/client';

describe('CloudFunction', function () {
  it('integration test cleanup', async function () {
    const functionName = process.env.CLEANUP_FUNCTION_NAME;
    if (!functionName) {
      throw new Error('missing CLEANUP_FUNCTION_NAME');
    }

    const client = new CloudFunctionsClient();

    const deleteF = await client.delete(functionName);
    expect(deleteF.done).to.be.true;
  });
});
