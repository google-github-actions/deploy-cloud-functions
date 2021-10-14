import { expect } from 'chai';
import 'mocha';
import { JWT } from 'google-auth-library';

const testNodeFuncDir = 'tests/test-node-func';
const name = `test-${Math.round(Math.random() * 100000)}`;
const credentials = process.env.DEPLOY_CF_SA_KEY_JSON;
const project = process.env.DEPLOY_CF_PROJECT_ID;
const region = 'us-east1';
const pubsubTopicFQN = process.env.DEPLOY_CF_EVENT_PUBSUB_TOPIC;

import { CloudFunctionClient } from '../src/cloudFunctionClient';
import { CloudFunction } from '../src/cloudFunction';

describe('CloudFunction', function () {
  it('initializes with JSON creds', function () {
    const client = new CloudFunctionClient(region, {
      credentials: `{"foo":"bar"}`,
      projectId: 'test',
    });
    expect(client.auth.jsonContent).eql({ foo: 'bar' });
  });

  it('discovers project id from creds', function () {
    const client = new CloudFunctionClient(region, {
      credentials: `{"foo":"bar", "project_id":"baz"}`,
    });
    expect(client.parent).eql(`projects/baz/locations/${region}`);
  });

  it('initializes with ADC', async function () {
    if (
      !process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      !process.env.GCLOUD_PROJECT
    ) {
      this.skip();
    }
    const client = new CloudFunctionClient(region);
    expect(client.auth.jsonContent).eql(null);
    const auth = (await client.getAuthClient()) as JWT;
    expect(auth.key).to.not.eql(undefined);
  });

  it('can deploy CF with httpTrigger', async function () {
    if (!credentials) {
      this.skip();
    }
    const client = new CloudFunctionClient(region, {
      credentials: credentials,
      projectId: project,
    });
    const newHttpFunc = new CloudFunction({
      name: `http-${name}`,
      parent: client.parent,
      sourceDir: testNodeFuncDir,
      runtime: 'nodejs10',
      envVars: 'KEY1=VALUE1,KEY2=VALUE2',
      secrets: `ENV_VAR1=DEPLOY_CF_SECRET:1
/MOUNT_PATH2:/SECRET_PATH2=projects/${project}/secrets/DEPLOY_CF_SECRET:latest`,
      entryPoint: 'helloWorld',
      availableMemoryMb: 512,
      projectId: client.projectId,
    });
    const result = await client.deploy(newHttpFunc);
    // expect function to be deployed without error
    expect(result).to.not.eql(null);
    expect(result.done).to.eq(true);
    expect(result).to.not.have.property('error');
    expect(result.response?.httpsTrigger.url).to.not.be.null;
    // expect function to be deleted without error
    const deleteFunc = await client.delete(newHttpFunc.functionPath);
    expect(deleteFunc.done).to.eq(true);
  });

  it('can deploy CF with eventTrigger', async function () {
    if (!credentials || !pubsubTopicFQN) {
      this.skip();
    }
    const client = new CloudFunctionClient(region, {
      credentials: credentials,
      projectId: project,
    });
    const eventTriggerType = 'providers/cloud.pubsub/eventTypes/topic.publish';
    const newEventFunc = new CloudFunction({
      name: `event-${name}`,
      parent: client.parent,
      sourceDir: testNodeFuncDir,
      runtime: 'nodejs10',
      envVars: 'KEY1=VALUE1,KEY2=VALUE2',
      secrets: `ENV_VAR1=DEPLOY_CF_SECRET:1
  /MOUNT_PATH2:/SECRET_PATH2=projects/${project}/secrets/DEPLOY_CF_SECRET:latest`,
      entryPoint: 'helloWorld',
      eventTriggerType: eventTriggerType,
      eventTriggerResource: pubsubTopicFQN,
      projectId: client.projectId,
    });

    const result = await client.deploy(newEventFunc);
    // expect function to be deployed without error
    expect(result).to.not.eql(null);
    expect(result.done).to.eq(true);
    expect(result).to.not.have.property('error');

    expect(result.response?.eventTrigger.eventType).to.eq(eventTriggerType);
    expect(result.response?.eventTrigger.resource).to.eq(pubsubTopicFQN);
    // expect function to be deleted without error
    const deleteFunc = await client.delete(newEventFunc.functionPath);
    expect(deleteFunc.done).to.eq(true);
  });

  it('can update a CF', async function () {
    if (!credentials) {
      this.skip();
    }
    const client = new CloudFunctionClient(region, {
      credentials: credentials,
      projectId: project,
    });
    const firstHttpFunc = new CloudFunction({
      name: `http-${name}`,
      parent: client.parent,
      sourceDir: testNodeFuncDir,
      runtime: 'nodejs10',
      envVars: 'KEY1=VALUE1,KEY2=VALUE2',
      secrets: `ENV_VAR1=DEPLOY_CF_SECRET:1
/MOUNT_PATH2:/SECRET_PATH2=projects/${project}/secrets/DEPLOY_CF_SECRET:latest`,
      entryPoint: 'helloWorld',
      projectId: client.projectId,
    });
    await client.deploy(firstHttpFunc);
    const updatedHttpFunc = new CloudFunction({
      name: `http-${name}`,
      parent: client.parent,
      sourceDir: testNodeFuncDir,
      runtime: 'nodejs10',
      envVars: 'KEY1=VALUE1,KEY2=VALUE2,KEY3=VALUE3',
      secrets: `ENV_VAR1=DEPLOY_CF_SECRET:1
/MOUNT_PATH2:/SECRET_PATH2=projects/${project}/secrets/DEPLOY_CF_SECRET:latest
ENV_VAR3=projects/${project}/secrets/DEPLOY_CF_SECRET:latest
/etc/secrets/SECRET_PATH4=projects/${project}/secrets/DEPLOY_CF_SECRET/versions/1`,
      entryPoint: 'helloWorld',
      projectId: client.projectId,
    });
    const result = await client.deploy(updatedHttpFunc);
    // expect function to be deployed without error
    expect(result).to.not.eql(null);
    expect(result.done).to.eq(true);
    expect(result).to.not.have.property('error');
    expect(result.response?.httpsTrigger.url).to.not.be.null;
    // expect to have version id 2
    expect(result.response?.versionId).to.eq('2');
    // expect to have the correct update
    expect(result.response?.environmentVariables.KEY3).to.eq('VALUE3');
    // expect function to be deleted without error
    const deleteFunc = await client.delete(updatedHttpFunc.functionPath);
    expect(deleteFunc.done).to.eq(true);
  });

  it('can deploy CF with envVarFile', async function () {
    if (!credentials) {
      this.skip();
    }
    const client = new CloudFunctionClient(region, {
      credentials: credentials,
      projectId: project,
    });
    const newHttpFunc = new CloudFunction({
      name: `http-envfile-${name}`,
      parent: client.parent,
      sourceDir: testNodeFuncDir,
      runtime: 'nodejs10',
      envVarsFile: 'tests/env-var-files/test.good.yaml',
      entryPoint: 'helloWorld',
      projectId: client.projectId,
    });
    const result = await client.deploy(newHttpFunc);
    // expect function to be deployed without error
    expect(result).to.not.eql(null);
    expect(result.done).to.eq(true);
    expect(result).to.not.have.property('error');
    expect(result.response?.httpsTrigger.url).to.not.be.null;
    // expect to have the correct env vars from env var file
    expect(result.response?.environmentVariables.KEY1).to.eq('VALUE1');
    expect(result.response?.environmentVariables.KEY2).to.eq('VALUE2');
    expect(result.response?.environmentVariables.JSONKEY).to.eq(
      '{"bar":"baz"}',
    );
    // expect function to be deleted without error
    const deleteFunc = await client.delete(newHttpFunc.functionPath);
    expect(deleteFunc.done).to.eq(true);
  });
});
