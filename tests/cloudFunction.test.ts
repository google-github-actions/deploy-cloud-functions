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
    const secrets =
      'ENV_VAR1=SECRET1:1\n' +
      '/etc/secrets/PATH1=projects/PROJECT1/secrets/SECRET1:latest';
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
      secrets: secrets,
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
    expect(cf.request.secretEnvironmentVariables?.[0].key).equal('ENV_VAR1');
    expect(cf.request.secretEnvironmentVariables?.[0].secret).equal('SECRET1');
    expect(cf.request.secretEnvironmentVariables?.[0].version).equal('1');
    expect(cf.request.secretVolumes?.[0].mountPath).equal('/etc/secrets');
    expect(cf.request.secretVolumes?.[0].projectId).equal('PROJECT1');
    expect(cf.request.secretVolumes?.[0].secret).equal('SECRET1');
    expect(cf.request.secretVolumes?.[0].versions?.[0].path).equal('/PATH1');
    expect(cf.request.secretVolumes?.[0].versions?.[0].version).equal('latest');
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

  it('creates an http function with one secret environment variable', function () {
    const secrets = 'ENV_VAR1=SECRET1:1';
    const cf = new CloudFunction({ name, runtime, parent, secrets });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.secretEnvironmentVariables?.[0].key).equal('ENV_VAR1');
    expect(cf.request.secretEnvironmentVariables?.[0].secret).equal('SECRET1');
    expect(cf.request.secretEnvironmentVariables?.[0].version).equal('1');
  });

  it('creates an http function with one secret volume', function () {
    const secrets =
      '/etc/secrets/PATH1=projects/PROJECT1/secrets/SECRET1:latest';
    const cf = new CloudFunction({ name, runtime, parent, secrets });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.secretVolumes?.[0].mountPath).equal('/etc/secrets');
    expect(cf.request.secretVolumes?.[0].projectId).equal('PROJECT1');
    expect(cf.request.secretVolumes?.[0].secret).equal('SECRET1');
    expect(cf.request.secretVolumes?.[0].versions?.[0].path).equal('/PATH1');
    expect(cf.request.secretVolumes?.[0].versions?.[0].version).equal('latest');
  });

  it('creates an http function with one secret volume', function () {
    const secrets =
      '/MOUNT_PATH1:/SECRET_PATH1=projects/PROJECT1/secrets/SECRET1/versions/1';
    const cf = new CloudFunction({ name, runtime, parent, secrets });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.secretVolumes?.[0].mountPath).equal('/MOUNT_PATH1');
    expect(cf.request.secretVolumes?.[0].projectId).equal('PROJECT1');
    expect(cf.request.secretVolumes?.[0].secret).equal('SECRET1');
    expect(cf.request.secretVolumes?.[0].versions?.[0].path).equal(
      '/SECRET_PATH1',
    );
    expect(cf.request.secretVolumes?.[0].versions?.[0].version).equal('1');
  });

  it('creates a http function with three secrets', function () {
    const secrets =
      'ENV_VAR1=SECRET1:1\n' +
      '/etc/secrets/PATH2=projects/PROJECT2/secrets/SECRET2:latest\n' +
      '/MOUNT_PATH3:/SECRET_PATH3=projects/PROJECT3/secrets/SECRET3/versions/3';
    const cf = new CloudFunction({ name, runtime, parent, secrets });
    expect(cf.request.name).equal(`${parent}/functions/${name}`);
    expect(cf.request.runtime).equal(runtime);
    expect(cf.request.httpsTrigger).not.to.be.null;
    expect(cf.request.secretEnvironmentVariables?.[0].key).equal('ENV_VAR1');
    expect(cf.request.secretEnvironmentVariables?.[0].secret).equal('SECRET1');
    expect(cf.request.secretEnvironmentVariables?.[0].version).equal('1');
    expect(cf.request.secretVolumes?.[0].mountPath).equal('/etc/secrets');
    expect(cf.request.secretVolumes?.[0].projectId).equal('PROJECT2');
    expect(cf.request.secretVolumes?.[0].secret).equal('SECRET2');
    expect(cf.request.secretVolumes?.[0].versions?.[0].path).equal('/PATH2');
    expect(cf.request.secretVolumes?.[0].versions?.[0].version).equal('latest');
    expect(cf.request.secretVolumes?.[1].mountPath).equal('/MOUNT_PATH3');
    expect(cf.request.secretVolumes?.[1].projectId).equal('PROJECT3');
    expect(cf.request.secretVolumes?.[1].secret).equal('SECRET3');
    expect(cf.request.secretVolumes?.[1].versions?.[0].path).equal(
      '/SECRET_PATH3',
    );
    expect(cf.request.secretVolumes?.[1].versions?.[0].version).equal('3');
  });

  it('throws an error with bad secrets', function () {
    const secrets = 'ENV_VAR1=SECRET1:latest\nSECRET2';
    expect(function () {
      new CloudFunction({ name, runtime, parent, secrets });
    }).to.throw(
      'The expected data format should be "ENV_VAR=SECRET_REF" or "/SECRET_PATH=SECRET_REF", got "SECRET2" while parsing "ENV_VAR1=SECRET1:latest\nSECRET2"',
    );
  });

  it('throws an error with bad secret ref pattern', function () {
    const secrets =
      '/etc/secrets/PATH2=projects/PROJECT2/secrets/SECRET2:latest\n' +
      '/MOUNT_PATH3:/SECRET_PATH3=SECRET3';
    expect(function () {
      new CloudFunction({ name, runtime, parent, secrets });
    }).to.throw(
      'The expected secrets value format must match the pattern "SECRET:VERSION", "projects/PROJECT/secrets/SECRET:VERSION" or "projects/PROJECT/secrets/SECRET/versions/VERSION", got "SECRET3"',
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
