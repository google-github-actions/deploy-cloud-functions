import { expect } from 'chai';
import 'mocha';

import { CloudFunction } from '../src/cloudFunction';

const name = 'fooFunction';
const runtime = 'fooRunTime';
const parent = 'projects/fooProject/locations/fooRegion';

describe('CloudFunction', function () {
  it('creates a http function', function () {
    const cf = new CloudFunction({ name, runtime, parent });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request).to.not.have.property('eventTrigger');
  });

  it('creates a http function with one envVar', function () {
    const envVars = 'KEY1=VALUE1';
    const cf = new CloudFunction({ name, runtime, parent, envVars });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE1');
  });

  it('creates an http function with one label', function () {
    const labels = 'label1=value1';
    const cf = new CloudFunction({ name, runtime, parent, labels });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.labels?.label1).equal('value1');
  });

  it('creates an http function with two labels', function () {
    const labels = 'label1=value1,label2=value2';
    const cf = new CloudFunction({ name, runtime, parent, labels });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.labels?.label1).equal('value1');
    expect(cf.request.labels?.label2).equal('value2');
  });

  it('creates a http function with optionals', function () {
    const envVars = 'KEY1=VALUE1';
    const labels = 'label1=value1';
    const funcOptions = {
      name: name,
      description: 'foo',
      sourceDir: '/foo/dir',
      envVars: envVars,
      entryPoint: 'bazFunction',
      runtime: runtime,
      vpcConnector: 'projects/foo/locations/bar/connectors/baz',
      vpcConnectorEgressSettings: 'ALL_TRAFFIC',
      ingressSettings: 'ALLOW_INTERNAL_ONLY',
      parent: parent,
      serviceAccountEmail: 'foo@bar.com',
      timeout: '500',
      maxInstances: 10,
      availableMemoryMb: 512,
      labels: labels,
    };
    const cf = new CloudFunction(funcOptions);
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(funcOptions.runtime);
    expect(cf.request.description).equal(funcOptions.description);
    expect(cf.sourceDir).equal(funcOptions.sourceDir);
    expect(cf.request.entryPoint).equal(funcOptions.entryPoint);
    expect(cf.request.vpcConnector).equal(funcOptions.vpcConnector);
    expect(cf.request.vpcConnectorEgressSettings).equal(
      funcOptions.vpcConnectorEgressSettings,
    );
    expect(cf.request.ingressSettings).equal(funcOptions.ingressSettings);
    expect(cf.request.serviceAccountEmail).equal(
      funcOptions.serviceAccountEmail,
    );
    expect(cf.request.timeout).equal(`${funcOptions.timeout}s`);
    expect(cf.request.maxInstances).equal(funcOptions.maxInstances);
    expect(cf.request.availableMemoryMb).equal(funcOptions.availableMemoryMb);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.labels?.label1).equal('value1');
  });

  it('creates a http function with three envVars', function () {
    const envVars = 'KEY1=VALUE1,KEY2=VALUE2,KEY3=VALUE3';
    const cf = new CloudFunction({ name, runtime, parent, envVars });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.environmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.environmentVariables?.KEY3).equal('VALUE3');
  });

  it('creates a http function with some quoted and some unquoted envVars', function () {
    const obj = { foo: 'bar', baz: 'foo' };
    const envVars = `KEY1="${JSON.stringify(obj)}",KEY2=VALUE2,KEY3=VALUE3`;
    const cf = new CloudFunction({ name, runtime, parent, envVars });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(
      JSON.parse(cf.request.environmentVariables?.KEY1 || '{}'),
    ).deep.equals(obj);
    expect(cf.request.environmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.environmentVariables?.KEY3).equal('VALUE3');
  });

  it('throws an error with bad envVars', function () {
    const envVars = 'KEY1,VALUE1';
    expect(function () {
      new CloudFunction({ name, runtime, parent, envVars });
    }).to.throw(
      'The expected data format should be "KEY1=VALUE1", got "KEY1" while parsing "KEY1,VALUE1"',
    );
  });

  it('throws an error with bad labels', function () {
    const envVars = 'label1=value1,label2';
    expect(function () {
      new CloudFunction({ name, runtime, parent, envVars });
    }).to.throw(
      'The expected data format should be "KEY1=VALUE1", got "label2" while parsing "label1=value1,label2"',
    );
  });

  it('Merge envVars and envVarsFile if both specified', function () {
    const envVarsFile = 'tests/env-var-files/test.good.yaml';
    const envVars = 'KEY3=VALUE3,KEY4=VALUE4';
    const cf = new CloudFunction({
      name,
      runtime,
      parent,
      envVarsFile,
      envVars,
    });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.environmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.environmentVariables?.JSONKEY).equal('{"bar":"baz"}');
    expect(cf.request.environmentVariables?.KEY3).equal('VALUE3');
    expect(cf.request.environmentVariables?.KEY4).equal('VALUE4');
  });

  it('Merge envVars and envVarsFile if both specified, with same key name. envVars will erase the value in envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.good.yaml';
    const envVars = 'KEY1=NEWVALUE1,KEY2=NEWVALUE2';
    const cf = new CloudFunction({
      name,
      runtime,
      parent,
      envVarsFile,
      envVars,
    });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.environmentVariables?.KEY1).equal('NEWVALUE1');
    expect(cf.request.environmentVariables?.KEY2).equal('NEWVALUE2');
    expect(cf.request.environmentVariables?.JSONKEY).equal('{"bar":"baz"}');
  });

  it('creates an event function', function () {
    const eventTriggerType = 'fooType';
    const eventTriggerResource = 'barResource';
    const cf = new CloudFunction({
      name,
      runtime,
      parent,
      eventTriggerType,
      eventTriggerResource,
    });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request).to.not.have.property('httpsTrigger');
    expect(cf.request.eventTrigger).not.to.be.null;
    expect(cf.request.eventTrigger?.eventType).equal(eventTriggerType);
    expect(cf.request.eventTrigger?.resource).equal(eventTriggerResource);
    expect(cf.request.eventTrigger?.service).to.be.undefined;
  });

  it('creates an event function with envVars', function () {
    const eventTriggerType = 'fooType';
    const eventTriggerResource = 'barResource';
    const envVars = 'KEY1=VALUE1';
    const cf = new CloudFunction({
      name,
      runtime,
      envVars,
      parent,
      eventTriggerType,
      eventTriggerResource,
    });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request).to.not.have.property('httpsTrigger');
    expect(cf.request.eventTrigger).not.to.be.null;
    expect(cf.request.eventTrigger?.eventType).equal(eventTriggerType);
    expect(cf.request.eventTrigger?.resource).equal(eventTriggerResource);
    expect(cf.request.eventTrigger?.service).to.be.undefined;
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE1');
  });

  it('throws an error if incorrect event config', function () {
    const eventTriggerResource = 'barResource';
    expect(function () {
      new CloudFunction({
        name,
        runtime,
        parent,
        eventTriggerResource,
      });
    }).to.throw(
      'For event triggered function, eventTriggerType and eventTriggerResource are required.',
    );
  });
});
