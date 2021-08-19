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

  it('creates a http function with one buildEnvVar', function () {
    const buildEnvVars = 'KEY1=VALUE1';
    const cf = new CloudFunction({ name, runtime, parent, buildEnvVars });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('VALUE1');
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
    const buildEnvVars = 'KEY1=VALUE1';
    const labels = 'label1=value1';
    const funcOptions = {
      name: name,
      description: 'foo',
      sourceDir: '/foo/dir',
      envVars: envVars,
      buildEnvVars: buildEnvVars,
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
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('VALUE1');
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

  it('creates a http function with three buildEnvVars', function () {
    const buildEnvVars = 'KEY1=VALUE1,KEY2=VALUE2,KEY3=VALUE3';
    const cf = new CloudFunction({ name, runtime, parent, buildEnvVars });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.buildEnvironmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.buildEnvironmentVariables?.KEY3).equal('VALUE3');
  });

  it('throws an error with bad envVars', function () {
    const envVars = 'KEY1,VALUE1';
    expect(function () {
      new CloudFunction({ name, runtime, parent, envVars });
    }).to.throw(
      'The expected data format should be "KEY1=VALUE1", got "KEY1" while parsing "KEY1,VALUE1"',
    );
  });

  it('throws an error with bad buildEnvVars', function () {
    const buildEnvVars = 'KEY1,VALUE1';
    expect(function () {
      new CloudFunction({ name, runtime, parent, buildEnvVars });
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

  it('creates a http function with two buildEnvVars containing equals character', function () {
    const buildEnvVars = 'KEY1=VALUE=1,KEY2=VALUE=2';
    const cf = new CloudFunction({ name, runtime, parent, buildEnvVars });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('VALUE=1');
    expect(cf.request.buildEnvironmentVariables?.KEY2).equal('VALUE=2');
  });

  it('creates a http function with envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.good.yaml';
    const cf = new CloudFunction({ name, runtime, parent, envVarsFile });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.environmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.environmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.environmentVariables?.JSONKEY).equal('{"bar":"baz"}');
  });

  it('creates a http function with buildEnvVarsFile', function () {
    const buildEnvVarsFile = 'tests/env-var-files/test.good.yaml';
    const cf = new CloudFunction({ name, runtime, parent, buildEnvVarsFile });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.buildEnvironmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.buildEnvironmentVariables?.JSONKEY).equal(
      '{"bar":"baz"}',
    );
  });

  it('throws an error with bad envVarsFile', function () {
    const envVarsFile = 'tests/env-var-files/test.bad.yaml';
    expect(function () {
      new CloudFunction({ name, runtime, parent, envVarsFile });
    }).to.throw(
      'env_vars_file yaml must contain only key/value pair of strings. Error parsing key KEY2 of type string with value VALUE2,VALUE3 of type object',
    );
  });

  it('throws an error with bad buildEnvVarsFile', function () {
    const buildEnvVarsFile = 'tests/env-var-files/test.bad.yaml';
    expect(function () {
      new CloudFunction({ name, runtime, parent, buildEnvVarsFile });
    }).to.throw(
      'build_env_vars_file yaml must contain only key/value pair of strings. Error parsing key KEY2 of type string with value VALUE2,VALUE3 of type object',
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

  it('throws an error with nonexistent buildEnvVarsFile', function () {
    const buildEnvVarsFile = 'tests/env-var-files/test.nonexistent.yaml';
    expect(function () {
      new CloudFunction({ name, runtime, parent, buildEnvVarsFile });
    }).to.throw(
      "ENOENT: no such file or directory, open 'tests/env-var-files/test.nonexistent.yaml",
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

  it('Merge buildEnvVars and buildEnvVarsFile if both specified', function () {
    const buildEnvVarsFile = 'tests/env-var-files/test.good.yaml';
    const buildEnvVars = 'KEY3=VALUE3,KEY4=VALUE4';
    const cf = new CloudFunction({
      name,
      runtime,
      parent,
      buildEnvVarsFile,
      buildEnvVars,
    });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('VALUE1');
    expect(cf.request.buildEnvironmentVariables?.KEY2).equal('VALUE2');
    expect(cf.request.buildEnvironmentVariables?.JSONKEY).equal(
      '{"bar":"baz"}',
    );
    expect(cf.request.buildEnvironmentVariables?.KEY3).equal('VALUE3');
    expect(cf.request.buildEnvironmentVariables?.KEY4).equal('VALUE4');
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

  it('Merge buildEnvVars and buildEnvVarsFile if both specified, with same key name. buildEnvVars will erase the value in buildEnvVarsFile', function () {
    const buildEnvVarsFile = 'tests/env-var-files/test.good.yaml';
    const buildEnvVars = 'KEY1=NEWVALUE1,KEY2=NEWVALUE2';
    const cf = new CloudFunction({
      name,
      runtime,
      parent,
      buildEnvVarsFile,
      buildEnvVars,
    });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('NEWVALUE1');
    expect(cf.request.buildEnvironmentVariables?.KEY2).equal('NEWVALUE2');
    expect(cf.request.buildEnvironmentVariables?.JSONKEY).equal(
      '{"bar":"baz"}',
    );
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

  it('creates an event function with buildEnvVars', function () {
    const eventTriggerType = 'fooType';
    const eventTriggerResource = 'barResource';
    const buildEnvVars = 'KEY1=VALUE1';
    const cf = new CloudFunction({
      name,
      runtime,
      buildEnvVars,
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
    expect(cf.request.buildEnvironmentVariables?.KEY1).equal('VALUE1');
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
