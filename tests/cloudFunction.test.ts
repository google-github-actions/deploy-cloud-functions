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

  it('creates a http function with two envVars containing equals character', function () {
    const envVars = 'KEY1=VALUE=1,KEY2=VALUE=2';
    const cf = new CloudFunction({ name, runtime, parent, envVars });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE=1');
    expect(cf.request.environmentVariables?.KEY2).equal('VALUE=2');
  });

  it('creates a http function with envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.good.yaml';
    const cf = new CloudFunction({ name, runtime, parent, envVarsFile });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.environmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.environmentVariables?.JSONKEY).equal('{"bar":"baz"}');
  });

  it('throws an error with bad envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.bad.yaml';
    expect(function () {
      new CloudFunction({ name, runtime, parent, envVarsFile });
    }).to.throw(
      'env_vars_file yaml must contain only key/value pair of strings. Error parsing key KEY2 of type string with value VALUE2,VALUE3 of type object',
    );
  });

  it('throws an error with nonexistent envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.nonexistent.yaml';
    expect(function () {
      new CloudFunction({ name, runtime, parent, envVarsFile });
    }).to.throw(
      "ENOENT: no such file or directory, open 'tests/env-var-files/test.nonexistent.yaml",
    );
  });

  it('throws an error with both envVarsFile and envVars specified', function () {
    const envVarsFile = 'tests/env-var-files/test.good.yaml';
    const envVars = 'KEY1=VALUE1,KEY2=VALUE2';
    expect(function () {
      new CloudFunction({ name, runtime, parent, envVarsFile, envVars });
    }).to.throw('Only one of env_vars or env_vars_file can be specified.');
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
