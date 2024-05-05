// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { readFile, writeFile } from 'fs/promises';
import * as YAML from 'yaml';

async function run() {
  const readmeContents = (await readFile('README.md', 'utf8')).split('\n');

  const actionContents = await readFile('action.yml', 'utf8');
  const action = YAML.parse(actionContents);

  const inputs = [];
  for (const [input, opts] of Object.entries(action.inputs)) {
    const required = opts.required ? 'Required' : 'Optional';
    const description = opts.description
      .split('\n')
      .map((line) => (line.trim() === '' ? '' : `    ${line}`))
      .join('\n')
      .trim();
    const def = opts.default ? `, default: \`${opts.default}\`` : '';
    const href = `input::${input}`;
    inputs.push(
      `-   <a name="${input}"></a><a href="#user-content-${input}"><code>${input}</code></a>: _(${required}${def})_ ${description}\n`,
    );
  }
  const startInputs = readmeContents.indexOf('<!-- BEGIN_AUTOGEN_INPUTS -->');
  const endInputs = readmeContents.indexOf('<!-- END_AUTOGEN_INPUTS -->');
  readmeContents.splice(startInputs + 1, endInputs - startInputs - 1, '', ...inputs, '');

  const outputs = [];
  for (const [output, opts] of Object.entries(action.outputs)) {
    const description = opts.description
      .split('\n')
      .map((line) => (line.trim() === '' ? '' : `    ${line}`))
      .join('\n')
      .trim();
    outputs.push(`-   \`${output}\`: ${description}\n`);
  }
  const startOutputs = readmeContents.indexOf('<!-- BEGIN_AUTOGEN_OUTPUTS -->');
  const endOutputs = readmeContents.indexOf('<!-- END_AUTOGEN_OUTPUTS -->');
  readmeContents.splice(startOutputs + 1, endOutputs - startOutputs - 1, '', ...outputs, '');

  await writeFile('README.md', readmeContents.join('\n'), 'utf8');
}

await run();
