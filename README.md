<!--
Copyright 2020 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->
# deploy-cloud-functions

This action deploys your function source code to [Cloud Functions](cloud-functions) and makes the URL
available to later build steps via outputs.

## Prerequisites

This action requires:

- Google Cloud credentials that are authorized to deploy a
Cloud Function. See the Authorization section below for more information.

- [Enable the Cloud Functions API](http://console.cloud.google.com/apis/library/cloudfunctions.googleapis.com?_ga=2.267842766.1374248275.1591025444-475066991.1589991158)

## Usage

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - uses: actions/checkout@v2

    - id: auth
      uses: google-github-actions/auth@v0
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: deploy
      uses: google-github-actions/deploy-cloud-functions@v0.7.0
      with:
        name: my-function
        runtime: nodejs10

    # Example of using the output
    - id: test
      run: curl "${{ steps.deploy.outputs.url }}"
```

## Inputs

- `name`: (Required) Name of the Cloud Function.

- `runtime`: (Required) Runtime to use for the function. Possible options documented [here][runtimes].

- `entry_point`: (Optional) Name of a function (as defined in source code) that will be executed. Defaults to the resource name suffix, if not specified.

- `memory_mb`: (Optional) The amount of memory in MB available for a function. Defaults to 256MB.

- `region`: (Optional) [Region](https://cloud.google.com/functions/docs/locations) in which the function should be deployed. Defaults to `us-central1`.

- `env_vars`: (Optional) List of key-value pairs to set as environment variables in the format:
  `KEY1=VALUE1,KEY2=VALUE2`. All existing environment variables will be
  removed, even if this parameter is not passed.

- `env_vars_file`: (Optional) Path to a local YAML file with definitions for all environment variables. An example env_vars_file can be found [here](tests/env-var-files/test.good.yaml). Only one of env_vars or env_vars_file can be specified.

- `labels`: (Optional) List of key-value pairs to set as function labels in the form label1=VALUE1,label2=VALUE2.

- `source_dir`: (Optional) Source directory for the function. Defaults to current directory.

- `project_id`: (Optional) ID of the Google Cloud project. If provided, this
  will override the project configured by gcloud.

- `description`: (Optional) Description for the Cloud Function.

- `vpc_connector`: (Optional) The VPC Access connector that the function can connect to..

- `vpc_connector_egress_settings`: (Optional) The egress settings for the connector, controlling what traffic is diverted through it.

- `ingress_settings`: (Optional) The ingress settings for the function, controlling what traffic can reach it.

- `secret_environment_variables`: (Optional) List of key-value pairs to set as
  environment variables at runtime of the format "KEY1=SECRET_VERSION_REF" where
  SECRET_VERSION_REF is a full resource name of a Google Secret Manager secret
  of the format "projects/p/secrets/s/versions/v". If the project is omitted, it
  will be inferred from the Cloud Function project ID. If the version is
  omitted, it will default to "latest".

    For example, this mounts version 5 of the `api-key` secret into `$API_KEY`
    inside the function's runtime:

    ```yaml
    secret_environment_variables: 'API_KEY=projects/my-project/secrets/api-key/versions/5'
    ```

- `secret_volumes`: (Optional) List of key-value pairs to mount as volumes at
  runtime of the format "PATH=SECRET_VERSION_REF" where PATH is the mount path
  inside the container (e.g. "/etc/secrets/my-secret") and SECRET_VERSION_REF is
  a full resource name of a Google Secret Manager secret of the format
  "projects/p/secrets/s/versions/v". If the project is omitted, it will be
  inferred from the Cloud Function project ID. If the version is omitted, it
  will default to "latest".

    For example, this mounts the latest value of the `api-key` secret at
    `/etc/secrets/api-key` inside the function's filesystem:

    ```yaml
    secret_volumes: '/etc/secrets/api-key=projects/my-project/secrets/api-key'
    ```

- `service_account_email`: (Optional) The email address of the IAM service account associated with the function at runtime.

- `timeout`: (Optional) The function execution timeout in seconds. Defaults to 60.

- `min_instances`: (Optional) The minimum number of instances for the function.

- `max_instances`: (Optional) The maximum number of instances for the function.

- `event_trigger_type`: (Optional) Specifies which action should trigger the function. Defaults to creation of http trigger.

- `event_trigger_resource`: (Optional) Specifies which resource from eventTrigger is observed.

- `event_trigger_service`: (Optional) The hostname of the service that should be observed.

- `event_trigger_retry`: (Optional) If true, the event will be retried if the
  function returns a failure. The default value is false. Note this applies to
  function invocation from events, not the deployment itself.

- `deploy_timeout`: (Optional) The function deployment timeout in seconds. Defaults to 300.

- `build_worker_pool`: (Optional) Name of the Cloud Build Custom Worker Pool
  that should be used to build the function. The format of this field is
  `projects/p/locations/l/workerPools/w`.

- `build_environment_variables`: (Optional) List of environment variables that
  should be available while the function is built. Note this is different than
  runtime environment variables, which should be set with 'env_vars'.

- `build_environment_variables_file`: (Optional) Path to a local YAML file
  containing variables. See 'env_vars_file' for syntax.

- `docker_repository`: (Optional) User managed repository created in Artifact
  Registry optionally with a customer managed encryption key. If specified,
  deployments will use Artifact Registry and must be of the format
  `projects/p/locations/l/repositories/r`. If unspecified and the deployment is
  eligible to use Artifact Registry, GCF will create and use a repository named
  'gcf-artifacts' for every deployed region. This is the repository to which the
  function docker image will be pushed after it is built by Cloud Build. For
  more information, please see [the
  documentation](https://cloud.google.com/sdk/gcloud/reference/beta/functions/deploy#--docker-repository).

- `kms_key_name`: (Optional) Resource name of a Google Cloud KMS crypto key used
  to encrypt/decrypt function resources of the format
  `projects/p/locations/l/keyRings/r/cryptoKeys/k`. If specified, you must also
  provide an artifact registry repository using the `docker_repository` field
  that was created with the same key.

- `credentials`: (**Deprecated**) This input is deprecated. See [auth section](https://github.com/google-github-actions/deploy-cloud-functions#via-google-github-actionsauth) for more details.
  Service account key to use for authentication. This should be
  the JSON formatted private key which can be exported from the Cloud Console. The
  value can be raw or base64-encoded.

## Allow unauthenticated requests

A Cloud Functions product recommendation is that CI/CD systems not set or change
settings for allowing unauthenticated invocations. New deployments are
automatically private services, while deploying a revision of a public
(unauthenticated) service will preserve the IAM setting of public
(unauthenticated). For more information, see [Controlling access on an individual service](https://cloud.google.com/functions/docs/securing/managing-access-iam).

## Outputs

- `url`: The URL of your Cloud Function. Only available with HTTP Trigger.

- `id`: The full resource name of the function (e.g. `projects/my-project/locations/my-location/functions/my-function.`)

- `status`: The status of the function (e.g. `ACTIVE`)

- `version`: The version of the function (e.g. `1`)

- `runtime`: The chosen runtime (e.g. `nodejs12`)

## Authorization

There are a few ways to authenticate this action. A service account will be needed
with the following roles:

- Cloud Functions Admin (`cloudfunctions.admin`):
  - Can create, update, and delete functions.
  - Can set IAM policies and view source code.

This service account needs to be a member of the `App Engine default service account`
`(PROJECT_ID@appspot.gserviceaccount.com)`, with role
`Service Account User` (`roles/iam.serviceAccountUser`). See [additional configuration for deployment](https://cloud.google.com/functions/docs/reference/iam/roles#additional-configuration)
for further instructions.

### Via google-github-actions/auth

Use [google-github-actions/auth](https://github.com/google-github-actions/auth) to authenticate the action. You can use [Workload Identity Federation][wif] or traditional [Service Account Key JSON][sa] authentication.
by specifying the `credentials` input. This Action supports both the recommended [Workload Identity Federation][wif] based authentication and the traditional [Service Account Key JSON][sa] based auth.

See [usage](https://github.com/google-github-actions/auth#usage) for more details.

#### Authenticating via Workload Identity Federation

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - uses: actions/checkout@v2

    - id: auth
      uses: google-github-actions/auth@v0
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: deploy
      uses: google-github-actions/deploy-cloud-functions@v0.7.0
      with:
        name: my-function
        runtime: nodejs10
```

#### Authenticating via Service Account Key JSON

```yaml
jobs:
  job_id:
    steps:
    - uses: actions/checkout@v2

    - id: auth
      uses: google-github-actions/auth@v0
      with:
        credentials_json: ${{ secrets.gcp_credentials }}

    - id: deploy
      uses: google-github-actions/deploy-cloud-functions@v0.7.0
      with:
        name: my-function
        runtime: nodejs10
```

### Via Application Default Credentials

If you are hosting your own runners, **and** those runners are on Google Cloud,
you can leverage the Application Default Credentials of the instance. This will
authenticate requests as the service account attached to the instance. **This
only works using a custom runner hosted on GCP.**

```yaml
jobs:
  job_id:
    steps:
    - uses: actions/checkout@v2

    - id: Deploy
      uses: google-github-actions/deploy-cloud-functions@v0.7.0
      with:
        name: my-function
        runtime: nodejs10
```

The action will automatically detect and use the Application Default
Credentials.

[cloud-functions]: https://cloud.google.com/functions
[runtimes]: https://cloud.google.com/sdk/gcloud/reference/functions/deploy#--runtime
[sm]: https://cloud.google.com/secret-manager
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[gh-runners]: https://help.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
[gh-secret]: https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets
[setup-gcloud]: https://github.com/google-github-actions/setup-gcloud
