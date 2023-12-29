# deploy-cloud-functions

This action deploys your function source code to [Cloud Functions][cloud-functions] and makes the URL
available to later build steps via outputs.

**This GitHub Action is _declarative_, meaning it will overwrite any values on
an existing Cloud Function deployment.** If you manually deployed a Cloud
Function, you must specify **all** parameters in this action. Any unspecified
values will be reverted to their default value (which is usually "null").

**This is not an officially supported Google product, and it is not covered by a
Google Cloud support contract. To report bugs or request features in a Google
Cloud product, please contact [Google Cloud
support](https://cloud.google.com/support).**


## Prerequisites

-   This action requires Google Cloud credentials that are authorized to access
    the secrets being requested. See [Authorization](#authorization) for more
    information.

-   This action runs using Node 16. If you are using self-hosted GitHub Actions
    runners, you must use runner version
    [2.285.0](https://github.com/actions/virtual-environments) or newer.


## Usage

```yaml
jobs:
  job_id:
    runs-on: 'ubuntu-latest'
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - uses: 'actions/checkout@v4'

    - id: 'auth'
      uses: 'google-github-actions/auth@v2'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-cloud-functions@v2'
      with:
        name: 'my-function'
        runtime: 'nodejs20'

    # Example of using the output
    - id: 'test'
      run: 'curl "${{ steps.deploy.outputs.url }}"'
```

## Inputs

- `name`: (Required) Name of the Cloud Function.

- `runtime`: (Required) Runtime to use for the function. Possible options documented [here][runtimes].

- `entry_point`: (Optional) Name of a function (as defined in source code) that will be executed. Defaults to the resource name suffix, if not specified.

- `memory_mb`: (Optional) The amount of memory in MB available for a function. Defaults to '256' (256 MB). The value must be the number of megabytes _without_ the unit suffix. Possible values documented [here][memory].

- `region`: (Optional) [Region](https://cloud.google.com/functions/docs/locations) in which the function should be deployed. Defaults to `us-central1`.

- `env_vars`: (Optional) List of comma-seperated key-value pairs to set as environment variables in the format: `KEY1=VALUE1,KEY2=VALUE2`. All existing environment variables will be removed, even if this parameter is not passed. Keys or values that contain a separator must be escaped with a backslash (`\,`, `\\n`). All leading and trailing whitespace is trimmed.

- `env_vars_file`: (Optional) Path to a local YAML file with definitions for all environment variables. An example env_vars_file can be found [here](tests/env-var-files/test.good.yaml). All existing environment variables will be removed, even if this parameter is not passed. If `env_vars` is also given, values in `env_vars` take precedence over these values.

- `labels`: (Optional) List of key-value pairs to set as function labels in the form `label1=VALUE1,label2=VALUE2`. All existing labels will be removed, even if this parameter is not passed.

- `source_dir`: (Optional) Source directory for the function. Defaults to current directory. The action does **not** follow symlinks to directories or files when generating the upload artifact.

- `project_id`: (Optional) ID of the Google Cloud project. If provided, this will override the project configured in the environment.

- `description`: (Optional) Description for the Cloud Function.

- `vpc_connector`: (Optional) The VPC Access connector that the function can connect to.

- `vpc_connector_egress_settings`: (Optional) The egress settings for the connector, controlling what traffic is diverted through it.

- `ingress_settings`: (Optional) The ingress settings for the function, controlling what traffic can reach it. Valid values: `ALLOW_ALL`, `ALLOW_INTERNAL_ONLY`, `ALLOW_INTERNAL_AND_GCLB` ([API Reference](https://cloud.google.com/functions/docs/reference/rest/v1/projects.locations.functions?hl=en_US#IngressSettings))

- `secret_environment_variables`: (Optional) List of key-value pairs to set as
  environment variables at runtime of the format `KEY1=SECRET_VERSION_REF` where
  `SECRET_VERSION_REF` is a full resource name of a Google Secret Manager secret
  of the format "projects/p/secrets/s/versions/v". If the version is omitted, it
  will default to "latest".

    For example, this mounts version 5 of the `api-key` secret into `$API_KEY`
    inside the function's runtime:

    ```yaml
    secret_environment_variables: 'API_KEY=projects/my-project/secrets/api-key/versions/5'
    ```

    All existing secrets will be removed, even if this parameter is not passed.

- `secret_volumes`: (Optional) List of key-value pairs to mount as volumes at
  runtime of the format "PATH=SECRET_VERSION_REF" where PATH is the mount path
  inside the container (e.g. "/etc/secrets/my-secret") and SECRET_VERSION_REF is
  a full resource name of a Google Secret Manager secret of the format
  "projects/p/secrets/s/versions/v". If the version is omitted, it will default
  to "latest".

    For example, this mounts the latest value of the `api-key` secret at
    `/etc/secrets/api-key` inside the function's filesystem:

    ```yaml
    secret_volumes: '/etc/secrets/api-key=projects/my-project/secrets/api-key'
    ```

    All existing secret volume mounts will be removed, even if this parameter is
    not passed.

- `service_account_email`: (Optional) The email address of the Google Cloud
  service account to use as the runtime service account for the function. If
  unspecified, the default Cloud Functions runtime service account is used.

    Note this differs from the service account used to deploy the Cloud
    Function, which is the currently-authenticated principal. See
    [Authorization](#Authorization) for more information.

- `timeout`: (Optional) The function execution timeout in seconds. Defaults to 60.

- `min_instances`: (Optional) The minimum number of instances for the function.

- `max_instances`: (Optional) The maximum number of instances for the function.

- `https_trigger_security_level`: (Optional) The security level for an
  HTTP(s)trigger. If set to `"secure_always"`, the function will only be
  accessible over the https protocol. If set to `"secure_optional"`, the
  function will be accessible over the http and https protocols. The default
  value is `"security_level_unspecified"`, which uses the platform's default
  value. We recommend setting this value to `"secure_always"` unless you need
  your function to be accessible over a non-TLS connection.

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

### Allowing unauthenticated requests

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

- `runtime`: The chosen runtime (e.g. `nodejs20`)

## Authorization

The _deployment_ service account must have the following IAM permissions:

-   Cloud Functions Admin (`roles/cloudfunctions.admin`)

Additionally, the _deployment_ service account must have permissions to act as
(impersonate) the _runtime_ service account, which can be achieved by granting
the deployment _service_ account "roles/iam.serviceAccountUser" permissions on
the _runtime_ service account. If unspecified, the _runtime_ service account is the App Engine Default Service Account `PROJECT_ID@appspot.gserviceaccount.com`.

In some cases, the Cloud Build service account, which defaults as
`PROJECT_NUMBER@cloudbuild.gserviceaccount.com`, may also need to be granted
"roles/iam.serviceAccountUser" permission on the _runtime_ service account.

See the Google Cloud documentation to [learn more about custom runtime service
accounts](https://cloud.google.com/functions/docs/securing/function-identity#individual)
and [additional configuration for
deployment](https://cloud.google.com/functions/docs/reference/iam/roles#additional-configuration)

### Via google-github-actions/auth

Use [google-github-actions/auth](https://github.com/google-github-actions/auth)
to authenticate the action. You can use [Workload Identity Federation][wif] or
traditional [Service Account Key JSON][sa] authentication.

#### Authenticating via Workload Identity Federation

```yaml
jobs:
  job_id:
    permissions:
      contents: 'read'
      id-token: 'write'

    steps:
    - uses: 'actions/checkout@v4'

    - id: 'auth'
      uses: 'google-github-actions/auth@v2'
      with:
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
        service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-cloud-functions@v2'
      with:
        name: 'my-function'
        runtime: 'nodejs20'
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
    - uses: 'actions/checkout@v4'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-cloud-functions@v2'
      with:
        name: 'my-function'
        runtime: 'nodejs20'
```

The action will automatically detect and use the Application Default
Credentials.

[cloud-functions]: https://cloud.google.com/functions
[runtimes]: https://cloud.google.com/sdk/gcloud/reference/functions/deploy#--runtime
[memory]: https://cloud.google.com/sdk/gcloud/reference/functions/deploy#--memory
[sm]: https://cloud.google.com/secret-manager
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[gh-runners]: https://help.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
[gh-secret]: https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets
