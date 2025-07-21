# deploy-cloud-functions

This action deploys your function source code to [Cloud Functions][cloud-functions] and makes the URL
available to later build steps via outputs.

> [!CAUTION]
>
> **This README corresponds to the "v3" GitHub Action**, which is currently in
> beta. If you are using "v2", see the [documentation for
> google-github-actions/deploy-cloud-functions@v2](https://github.com/google-github-actions/deploy-cloud-functions/tree/release/v2).

**This is not an officially supported Google product, and it is not covered by a
Google Cloud support contract. To report bugs or request features in a Google
Cloud product, please contact [Google Cloud
support](https://cloud.google.com/support).**


## Prerequisites

-   This action requires Google Cloud credentials that are authorized to access
    the secrets being requested. See [Authorization](#authorization) for more
    information.

-   This action runs using Node 20. If you are using self-hosted GitHub Actions
    runners, you must use a version of the GitHub Actions runner that supports
    Node 20 or higher.


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
        project_id: 'my-project'
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-cloud-functions@v3'
      timeout-minutes: 10
      with:
        name: 'my-function'
        runtime: 'nodejs22'

    # Example of using the output
    - id: 'test'
      run: 'curl "${{ steps.deploy.outputs.url }}"'
```

## Inputs

> [!IMPORTANT]
>
> In addition to these inputs, we **highly recommend** setting [job and
> step-level
> timeouts](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepstimeout-minutes),
> which can be used to control total deployment time.

<!-- BEGIN_AUTOGEN_INPUTS -->

-   <a name="project_id"></a><a href="#user-content-project_id"><code>project_id</code></a>: _(Optional)_ ID of the Google Cloud project in which to deploy the service. The default
    value is computed from the environment.

-   <a name="region"></a><a href="#user-content-region"><code>region</code></a>: _(Optional, default: `us-central1`)_ Region in which the function should be deployed.

-   <a name="universe"></a><a href="#user-content-universe"><code>universe</code></a>: _(Optional, default: `googleapis.com`)_ The Google Cloud universe to use for constructing API endpoints. Trusted
    Partner Cloud and Google Distributed Hosted Cloud should set this to their
    universe address.

    You can also override individual API endpoints by setting the environment
    variable `GHA_ENDPOINT_OVERRIDE_<endpoint>` where `<endpoint>` is the API
    endpoint to override. For example:

    ```yaml
    env:
      GHA_ENDPOINT_OVERRIDE_oauth2: 'https://oauth2.myapi.endpoint/v1'
    ```

    For more information about universes, see the Google Cloud documentation.

-   <a name="name"></a><a href="#user-content-name"><code>name</code></a>: _(Required)_ Name of the Cloud Function.

-   <a name="description"></a><a href="#user-content-description"><code>description</code></a>: _(Optional)_ Human-friendly description of the Cloud Function.

-   <a name="environment"></a><a href="#user-content-environment"><code>environment</code></a>: _(Optional, default: `GEN_2`)_ Runtime environment for the Cloud Function. Allowed values are "GEN_1" and
    "GEN_2", but this GitHub Action only provides support for "GEN_2".

-   <a name="kms_key_name"></a><a href="#user-content-kms_key_name"><code>kms_key_name</code></a>: _(Optional)_ Resource name of a Google Cloud KMS crypto key used to encrypt/decrypt
    function resources. If specified, you must also provide an artifact
    registry repository using the 'docker_repository' field that was created
    with the same key.

-   <a name="labels"></a><a href="#user-content-labels"><code>labels</code></a>: _(Optional)_ List of labels that should be set on the function. These are
    comma-separated or newline-separated `KEY=VALUE`. Keys or values that
    contain separators must be escaped with a backslash (e.g. `\,` or `\\n`)
    unless quoted. Any leading or trailing whitespace is trimmed unless values
    are quoted.

    ```yaml
    labels: |-
      labela=my-label
      labelb=my-other-label
    ```

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    Google Cloud restricts the allowed values and length for labels. Please
    see the Google Cloud documentation for labels for more information.

-   <a name="source_dir"></a><a href="#user-content-source_dir"><code>source_dir</code></a>: _(Optional, default: `./`)_ Path on disk to the root of the the function's source code. Defaults to
    current directory. This does NOT follow symlinks to directories or files
    when generating the upload artifact.

    **NOTE:** The function source code must exist on the GitHub Actions
    filesystem. This means you must have `use: actions/checkout@v4` before the
    deployment step!.

-   <a name="runtime"></a><a href="#user-content-runtime"><code>runtime</code></a>: _(Required)_ Runtime for the function, such as "nodejs20". For a list of all available
    runtimes, run:

        $ gcloud functions runtimes list

    The available runtimes change over time.

-   <a name="build_environment_variables"></a><a href="#user-content-build_environment_variables"><code>build_environment_variables</code></a>: _(Optional)_ List of environment variables that should be set in the build environment.
    These are comma-separated or newline-separated `KEY=VALUE`. Keys or values
    that contain separators must be escaped with a backslash (e.g. `\,` or
    `\\n`) unless quoted. Any leading or trailing whitespace is trimmed unless
    values are quoted.

    ```yaml
    build_environment_variables: |-
      FRUIT=apple
      SENTENCE=" this will retain leading and trailing spaces "
    ```

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    Previous versions of this GitHub Action also included a separate input for
    sourcing values from a value, but this is no longer supported. Use a
    community action or script to read the file in a separate step and import
    the contents as an output.

-   <a name="build_service_account"></a><a href="#user-content-build_service_account"><code>build_service_account</code></a>: _(Optional)_ Service account to be used for building the container.

-   <a name="build_worker_pool"></a><a href="#user-content-build_worker_pool"><code>build_worker_pool</code></a>: _(Optional)_ Name of the Cloud Build Custom Worker Pool that should be used to build
    the function. The format of this field is:

        projects/<project>/locations/<region>/workerPools/<workerPool>

    where `<project>` and `<region>` are the project id and region
    respectively where the worker pool is defined and `<workerPool>` is the
    short name of the worker pool.

    If the project ID is not the same as the function, then the Cloud
    Functions Service Agent must be granted the role Cloud Build Custom
    Workers Builder in the project.

-   <a name="docker_repository"></a><a href="#user-content-docker_repository"><code>docker_repository</code></a>: _(Optional)_ Repository in Artifact Registry to which the function docker image will be
    pushed after it is built by Cloud Build. If unspecified, Cloud Functions
    will create and use a repository named 'gcf-artifacts' for every deployed
    region.

    The value must match the pattern:

        projects/<project>/locations/<location>/repositories/<repository>.

    Cross-project repositories are not supported. Cross-location repositories
    are not supported. Repository format must be 'DOCKER'.

-   <a name="entry_point"></a><a href="#user-content-entry_point"><code>entry_point</code></a>: _(Optional)_ Name of a Google Cloud Function (as defined in source code) that will be
    executed. Defaults to the resource name suffix (ID of the function), if
    not specified.

-   <a name="all_traffic_on_latest_revision"></a><a href="#user-content-all_traffic_on_latest_revision"><code>all_traffic_on_latest_revision</code></a>: _(Optional, default: `true`)_ If true, the latest function revision will be served all traffic.

-   <a name="cpu"></a><a href="#user-content-cpu"><code>cpu</code></a>: _(Optional)_ The number of available CPUs to set (e.g. 0.5, 2, 2000m). By default, a
    new function's available CPUs is determined based on its memory value.

-   <a name="memory"></a><a href="#user-content-memory"><code>memory</code></a>: _(Optional)_ The amount of memory available for the function to use. Allowed values are
    of the format: <number><unit> with allowed units of "k", "M", "G", "Ki",
    "Mi", "Gi" (e.g 128M, 10Mb, 1024Gi).

    For all generations, the default value is 256MB of memory.

-   <a name="environment_variables"></a><a href="#user-content-environment_variables"><code>environment_variables</code></a>: _(Optional)_ List of environment variables that should be set in the runtime
    environment. These are comma-separated or newline-separated `KEY=VALUE`.
    Keys or values that contain separators must be escaped with a backslash
    (e.g. `\,` or `\\n`) unless quoted. Any leading or trailing whitespace is
    trimmed unless values are quoted.

    ```yaml
    environment_variables: |-
      FRUIT=apple
      SENTENCE=" this will retain leading and trailing spaces "
    ```

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    Previous versions of this GitHub Action also included a separate input for
    sourcing values from a value, but this is no longer supported. Use a
    community action or script to read the file in a separate step and import
    the contents as an output.

-   <a name="ingress_settings"></a><a href="#user-content-ingress_settings"><code>ingress_settings</code></a>: _(Optional, default: `ALLOW_ALL`)_ Ingress settings controls what traffic can reach the function. Valid
    values are "ALLOW_ALL", "ALLOW_INTERNAL_ONLY", and
    "ALLOW_INTERNAL_AND_GCLB".

-   <a name="max_instance_count"></a><a href="#user-content-max_instance_count"><code>max_instance_count</code></a>: _(Optional)_ Sets the maximum number of instances for the function. A function
    execution that would exceed max-instances times out.

-   <a name="max_instance_request_concurrency"></a><a href="#user-content-max_instance_request_concurrency"><code>max_instance_request_concurrency</code></a>: _(Optional)_ Sets the maximum number of concurrent requests allowed per container
    instance.

-   <a name="min_instance_count"></a><a href="#user-content-min_instance_count"><code>min_instance_count</code></a>: _(Optional)_ Sets the minimum number of instances for the function. This is helpful for
    reducing cold start times.

-   <a name="secrets"></a><a href="#user-content-secrets"><code>secrets</code></a>: _(Optional)_ List of KEY=VALUE pairs to use as secrets. These are comma-separated or
    newline-separated `KEY=VALUE`. Keys or values that contain separators must
    be escaped with a backslash (e.g. `\,` or `\\n`) unless quoted. Any
    leading or trailing whitespace is trimmed unless values are quoted.

    These can either be injected as environment variables or mounted as
    volumes. Keys starting with a forward slash '/' are mount paths. All other
    keys correspond to environment variables:


    ```yaml
    with:
      secrets: |-
        # As an environment variable:
        KEY1=projects/my-project/secrets/my-secret/versions/latest

        # As a volume mount:
        /secrets/api/key=projects/my-project/secrets/my-secret/versions/123
    ```

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

-   <a name="service_account"></a><a href="#user-content-service_account"><code>service_account</code></a>: _(Optional)_ The email address of the IAM service account associated with the Cloud Run
    service for the function. The service account represents the identity of
    the running function, and determines what permissions the function has. If
    not provided, the function will use the project's default service account
    for Compute Engine.

    Note this differs from the service account used to deploy the Cloud
    Function, which is the currently-authenticated principal. However, the
    deploying service account must have permission to impersonate the runtime
    service account, which can be achieved by granting the deployment service
    account "roles/iam.serviceAccountUser" permission on the runtime service
    account.

-   <a name="service_timeout"></a><a href="#user-content-service_timeout"><code>service_timeout</code></a>: _(Optional, default: `60s`)_ The function execution timeout, specified as a time duration (e.g. "30s"
    for 30 seconds).

-   <a name="vpc_connector"></a><a href="#user-content-vpc_connector"><code>vpc_connector</code></a>: _(Optional)_ ID of the connector or fully qualified identifier for the connector.

-   <a name="vpc_connector_egress_settings"></a><a href="#user-content-vpc_connector_egress_settings"><code>vpc_connector_egress_settings</code></a>: _(Optional, default: `PRIVATE_RANGES_ONLY`)_ Egress settings controls what traffic is diverted through the VPC Access
    Connector resource. Allowed values are "PRIVATE_RANGES_ONLY" and
    "ALL_TRAFFIC".

-   <a name="event_trigger_location"></a><a href="#user-content-event_trigger_location"><code>event_trigger_location</code></a>: _(Optional)_ The location of the trigger, which must be a region or multi-region where
    the relevant events originate.

-   <a name="event_trigger_type"></a><a href="#user-content-event_trigger_type"><code>event_trigger_type</code></a>: _(Optional)_ Specifies which action should trigger the function. For a list of
    acceptable values, run:

        $ gcloud functions event-types list

    This usually requires the eventarc API to be enabled:

        $ gcloud services enable eventarc.googleapis.com

    The available trigger types may change over time.

-   <a name="event_trigger_filters"></a><a href="#user-content-event_trigger_filters"><code>event_trigger_filters</code></a>: _(Optional)_ List of event filters that the trigger should monitor. An event that
    matches all the filteres will trigger calls to the function. These are
    comma-separated or newline-separated `ATTRIBUTE=VALUE`. Attributes or
    values that contain separators must be escaped with a backslash (e.g. `\,`
    or `\\n`) unless quoted. To treat a value as a path pattern, prefix the
    value with the literal string `PATTERN:`. Any leading or trailing
    whitespace is trimmed unless values are quoted.

    ```yaml
    event_trigger_type: 'google.cloud.audit.log.v1.written'
    event_trigger_filters: |-
      serviceName=compute.googleapis.com
      methodName=PATTERN:compute.instances.*
    ```

    This value will only be set if the input is a non-empty value. If a
    non-empty value is given, the field values will be overwritten (not
    merged). To remove all values, set the value to the literal string `{}`.

    For more information, see [Eventarc
    Triggers](https://cloud.google.com/functions/docs/calling/eventarc) and
    [Eventarc Path
    Patterns](https://cloud.google.com/eventarc/docs/path-patterns).

-   <a name="event_trigger_pubsub_topic"></a><a href="#user-content-event_trigger_pubsub_topic"><code>event_trigger_pubsub_topic</code></a>: _(Optional)_ Name of Google Cloud Pub/Sub topic. Every message published in this topic
    will trigger function execution with message contents passed as input
    data of the format:

        projects/<project_id>/topics/<topic_id>

    The service account must have permissions on this topic.

-   <a name="event_trigger_service_account"></a><a href="#user-content-event_trigger_service_account"><code>event_trigger_service_account</code></a>: _(Optional)_ The email address of the IAM service account associated with the Eventarc
    trigger for the function. This is used for authenticated invocation.

-   <a name="event_trigger_retry"></a><a href="#user-content-event_trigger_retry"><code>event_trigger_retry</code></a>: _(Optional, default: `true`)_ Describes whether event triggers should retry in case of function's
    execution failure.

-   <a name="event_trigger_channel"></a><a href="#user-content-event_trigger_channel"><code>event_trigger_channel</code></a>: _(Optional)_ The name of the channel associated with the trigger in the format:

        projects/<project>/locations/<location>/channels/<channel>

    You must provide a channel to receive events from Eventarc SaaS partners.


<!-- END_AUTOGEN_INPUTS -->


### Allowing unauthenticated requests

The Cloud Functions product recommendation is that CI/CD systems not set or
change settings for allowing unauthenticated invocations. New deployments are
automatically private services, while deploying a revision of a public
(unauthenticated) service will preserve the IAM setting of public
(unauthenticated). For more information, see [Controlling access on an
individual
service](https://cloud.google.com/functions/docs/securing/managing-access-iam).

## Outputs

<!-- BEGIN_AUTOGEN_OUTPUTS -->

-   `name`: Full resource name of the Cloud Function, of the format:

        projects/<project>/locations/<location>/functions/<function>

-   `url`: The URL of your Cloud Function.


<!-- END_AUTOGEN_OUTPUTS -->


## Authorization

The _deployment_ service account must have the following IAM permissions:

-   Cloud Functions Developer (`roles/cloudfunctions.developer`)

Additionally, the _deployment_ service account must have permissions to act as
(impersonate) the _runtime_ service account, which can be achieved by granting
the deployment _service_ account "roles/iam.serviceAccountUser" permissions on
the _runtime_ service account. See the Google Cloud documentation to [learn more
about custom runtime service
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
        project_id: 'my-project'
        workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'

    - id: 'deploy'
      uses: 'google-github-actions/deploy-cloud-functions@v3'
      timeout-minutes: 10
      with:
        name: 'my-function'
        runtime: 'nodejs22'
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
      uses: 'google-github-actions/deploy-cloud-functions@v3'
      timeout-minutes: 10
      with:
        name: 'my-function'
        runtime: 'nodejs22'
```

The action will automatically detect and use the Application Default
Credentials.

[cloud-functions]: https://cloud.google.com/functions
[memory]: https://cloud.google.com/sdk/gcloud/reference/functions/deploy#--memory
[sm]: https://cloud.google.com/secret-manager
[wif]: https://cloud.google.com/iam/docs/workload-identity-federation
[sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[gh-runners]: https://help.github.com/en/actions/hosting-your-own-runners/about-self-hosted-runners
[gh-secret]: https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets
