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

import StreamZip from 'node-stream-zip';
import { assertMembers, randomFilepath } from '@google-github-actions/actions-utils';

import {
  parseDirectVpc,
  parseDirectVpcEgress,
  parseEventTriggerFilters,
  stringToInt,
  zipDir,
} from '../src/util';
import { DirectVpcEgress, Environment } from '../src/client';

test('#zipDir', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'throws an error if sourceDir does not exist',
      zipDir: '/not/a/real/path',
      expectedFiles: [],
      error: 'Unable to find',
    },
    {
      name: 'creates a zipfile with correct files without gcloudignore',
      zipDir: 'tests/test-node-func',
      expectedFiles: ['.dotfile', 'index.js', 'package.json'],
    },
    {
      name: 'creates a zipfile with correct files with simple gcloudignore',
      zipDir: 'tests/test-func-ignore',
      expectedFiles: ['index.js', 'package.json'],
    },
    {
      name: 'creates a zipfile with correct files with simple gcloudignore',
      zipDir: 'tests/test-func-ignore-node',
      expectedFiles: [
        '.gcloudignore',
        'foo/data.txt',
        'index.js',
        'notIgnored.txt',
        'package.json',
      ],
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.error) {
        await assert.rejects(async () => {
          await zipDir(tc.zipDir, randomFilepath());
        }, new RegExp(tc.error));
      } else {
        const zf = await zipDir(tc.zipDir, randomFilepath());
        const filesInsideZip = await getFilesInZip(zf);
        assertMembers(filesInsideZip, tc.expectedFiles);
      }
    });
  }
});

test('#stringToInt', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'empty',
      input: '',
      expected: undefined,
    },
    {
      name: 'spaces',
      input: ' ',
      expected: undefined,
    },
    {
      name: 'digit',
      input: '1',
      expected: 1,
    },
    {
      name: 'multi-digit',
      input: '123',
      expected: 123,
    },
    {
      name: 'suffix',
      input: '100MB',
      expected: 100,
    },
    {
      name: 'comma',
      input: '1,000',
      expected: 1000,
    },
    {
      name: 'NaN',
      input: 'this is definitely not a number',
      error: 'input "this is definitely not a number" is not a number',
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.error) {
        assert.throws(() => {
          stringToInt(tc.input);
        }, new RegExp(tc.error));
      } else {
        const actual = stringToInt(tc.input);
        assert.deepStrictEqual(actual, tc.expected);
      }
    });
  }
});

test('#parseEventTriggerFilters', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'empty',
      input: '',
      expected: undefined,
    },
    {
      name: 'braces',
      input: '{}',
      expected: [],
    },
    {
      name: 'braces',
      input: `
        type=google.cloud.audit.log.v1.written
        serviceName=compute.googleapis.com
        methodName=PATTERN:compute.instances.*
      `,
      expected: [
        {
          attribute: 'type',
          value: 'google.cloud.audit.log.v1.written',
        },
        {
          attribute: 'serviceName',
          value: 'compute.googleapis.com',
        },
        {
          attribute: 'methodName',
          value: 'compute.instances.*',
          operator: 'match-path-pattern',
        },
      ],
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      const actual = parseEventTriggerFilters(tc.input);
      assert.deepStrictEqual(actual, tc.expected);
    });
  }
});

test('#parseDirectVpcEgress', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'empty',
      input: '',
      expected: undefined,
    },
    {
      name: 'undefined',
      input: undefined,
      expected: undefined,
    },
    {
      name: 'kebab-case private-ranges-only',
      input: 'private-ranges-only',
      expected: DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY,
    },
    {
      name: 'upper case PRIVATE_RANGES_ONLY',
      input: 'PRIVATE_RANGES_ONLY',
      expected: DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY,
    },
    {
      name: 'full enum VPC_EGRESS_PRIVATE_RANGES_ONLY',
      input: 'VPC_EGRESS_PRIVATE_RANGES_ONLY',
      expected: DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY,
    },
    {
      name: 'kebab-case all-traffic',
      input: 'all-traffic',
      expected: DirectVpcEgress.VPC_EGRESS_ALL_TRAFFIC,
    },
    {
      name: 'upper case ALL_TRAFFIC',
      input: 'ALL_TRAFFIC',
      expected: DirectVpcEgress.VPC_EGRESS_ALL_TRAFFIC,
    },
    {
      name: 'full enum VPC_EGRESS_ALL_TRAFFIC',
      input: 'VPC_EGRESS_ALL_TRAFFIC',
      expected: DirectVpcEgress.VPC_EGRESS_ALL_TRAFFIC,
    },
    {
      name: 'invalid string throws error',
      input: 'invalid-egress',
      error: /Invalid value 'invalid-egress' for 'direct_vpc_egress'/,
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.error) {
        assert.throws(() => {
          parseDirectVpcEgress(tc.input);
        }, tc.error);
      } else {
        const actual = parseDirectVpcEgress(tc.input);
        assert.strictEqual(actual, tc.expected);
      }
    });
  }
});

test('#parseDirectVpc', { concurrency: true }, async (suite) => {
  const cases = [
    {
      name: 'no direct vpc inputs returns empty object',
      input: {},
      expected: {},
    },
    {
      name: 'network alone sets network and default egress',
      input: {
        network: 'projects/p/global/networks/my-net',
      },
      expected: {
        directVpcNetworkInterface: [
          {
            network: 'projects/p/global/networks/my-net',
          },
        ],
        directVpcEgress: DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY,
      },
    },
    {
      name: 'subnet alone sets subnetwork and default egress',
      input: {
        subnet: 'projects/p/regions/r/subnetworks/my-subnet',
      },
      expected: {
        directVpcNetworkInterface: [
          {
            subnetwork: 'projects/p/regions/r/subnetworks/my-subnet',
          },
        ],
        directVpcEgress: DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY,
      },
    },
    {
      name: 'network and subnet with tags and explicit egress',
      input: {
        network: 'my-net',
        subnet: 'my-subnet',
        networkTags: 'tag1, tag2,tag3',
        directVpcEgress: 'all-traffic',
      },
      expected: {
        directVpcNetworkInterface: [
          {
            network: 'my-net',
            subnetwork: 'my-subnet',
            tags: ['tag1', 'tag2', 'tag3'],
          },
        ],
        directVpcEgress: DirectVpcEgress.VPC_EGRESS_ALL_TRAFFIC,
      },
    },
    {
      name: 'network and subnet with spaced tags trims whitespace',
      input: {
        network: 'my-net',
        subnet: 'my-subnet',
        networkTags: '  tag-a  ,   tag-b   , tag-c ',
      },
      expected: {
        directVpcNetworkInterface: [
          {
            network: 'my-net',
            subnetwork: 'my-subnet',
            tags: ['tag-a', 'tag-b', 'tag-c'],
          },
        ],
        directVpcEgress: DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY,
      },
    },
    {
      name: 'network and subnet alone without tags or explicit egress',
      input: {
        network: 'my-net',
        subnet: 'my-subnet',
      },
      expected: {
        directVpcNetworkInterface: [
          {
            network: 'my-net',
            subnetwork: 'my-subnet',
          },
        ],
        directVpcEgress: DirectVpcEgress.VPC_EGRESS_PRIVATE_RANGES_ONLY,
      },
    },
    {
      name: 'throws when both vpc_connector and network are specified',
      input: {
        vpcConnector: 'my-connector',
        network: 'my-net',
      },
      error: /Cannot specify both 'vpc_connector' and Direct VPC settings/,
    },
    {
      name: 'throws when both vpc_connector and subnet are specified',
      input: {
        vpcConnector: 'my-connector',
        subnet: 'my-subnet',
      },
      error: /Cannot specify both 'vpc_connector' and Direct VPC settings/,
    },
    {
      name: 'throws when network_tags specified without network or subnet',
      input: {
        networkTags: 'tag1',
      },
      error:
        /Cannot specify 'network_tags' or 'direct_vpc_egress' without specifying 'network' or 'subnet'/,
    },
    {
      name: 'throws when direct_vpc_egress specified without network or subnet',
      input: {
        directVpcEgress: 'all-traffic',
      },
      error:
        /Cannot specify 'network_tags' or 'direct_vpc_egress' without specifying 'network' or 'subnet'/,
    },
    {
      name: 'throws when GEN_1 environment specified with Direct VPC settings',
      input: {
        environment: Environment.GEN_1,
        network: 'my-net',
      },
      error:
        /Direct VPC Egress is only supported on 2nd gen Cloud Functions \(got environment: 'GEN_1'\)/,
    },
  ];

  for await (const tc of cases) {
    await suite.test(tc.name, async () => {
      if (tc.error) {
        assert.throws(() => {
          parseDirectVpc(tc.input);
        }, tc.error);
      } else {
        const actual = parseDirectVpc(tc.input);
        assert.deepStrictEqual(actual, tc.expected);
      }
    });
  }
});

/**
 *
 * @param zipFilePath path to zipfile
 * @returns list of files within zipfile
 */
async function getFilesInZip(zipFilePath: string): Promise<string[]> {
  const uzf = new StreamZip.async({ file: zipFilePath });
  const zipEntries = await uzf.entries();
  const filesInsideZip: string[] = [];
  for (const k in zipEntries) {
    if (zipEntries[k].isFile) {
      filesInsideZip.push(zipEntries[k].name);
    }
  }
  return filesInsideZip;
}
