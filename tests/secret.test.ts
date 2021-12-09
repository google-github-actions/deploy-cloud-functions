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

import { expect } from 'chai';
import 'mocha';

import { SecretName } from '../src/secret';

describe('SecretName', function () {
  const cases = [
    {
      name: 'empty string',
      input: '',
      error: 'Missing secret name',
    },
    {
      name: 'null',
      input: null,
      error: 'Missing secret name',
    },
    {
      name: 'undefined',
      input: undefined,
      error: 'Missing secret name',
    },
    {
      name: 'bad resource name',
      input: 'projects/fruits/secrets/apple/versions/123/subversions/5',
      error: 'Failed to parse secret reference',
    },
    {
      name: 'bad resource name',
      input: 'projects/fruits/secrets/apple/banana/bacon/pants',
      error: 'Failed to parse secret reference',
    },
    {
      name: 'full resource name',
      input: 'projects/fruits/secrets/apple/versions/123',
      expected: {
        project: 'fruits',
        secret: 'apple',
        version: '123',
      },
    },
    {
      name: 'full resource name without version',
      input: 'projects/fruits/secrets/apple',
      expected: {
        project: 'fruits',
        secret: 'apple',
        version: 'latest',
      },
    },
    {
      name: 'short ref',
      input: 'fruits/apple/123',
      expected: {
        project: 'fruits',
        secret: 'apple',
        version: '123',
      },
    },
    {
      name: 'short ref without version',
      input: 'fruits/apple',
      expected: {
        project: 'fruits',
        secret: 'apple',
        version: 'latest',
      },
    },
  ];

  cases.forEach((tc) => {
    it(tc.name, async () => {
      if (tc.expected) {
        const secret = new SecretName(tc.input);
        expect(secret.project).to.eq(tc.expected.project);
        expect(secret.name).to.eq(tc.expected.secret);
        expect(secret.version).to.eq(tc.expected.version);
      } else if (tc.error) {
        expect(() => {
          new SecretName(tc.input);
        }).to.throw(tc.error);
      }
    });
  });
});
