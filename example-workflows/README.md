# Cloud Functions - GitHub Actions

An example [workflow](.github/workflows/cloud-functions.yml) that uses [GitHub Actions][actions] to deploy a
[Hello World Python app](main.py) to [Cloud Funtions][cloud-functions].

This code is intended to be an _example_. You will likely need to change or
update values to match your setup.

## Workflow description

For pushes to the `main` branch, this workflow will:

1.  Set up job
    - Current runner version: '2.275.1'
    - Operating System (Ubuntu 18.04.5)
    - Virtual Environment
    - Prepare workflow directory
    - Prepare all required actions
    - Getting action download info
    - Download action repository 'actions/checkout@v2'
    - Download action repository 'google-github-actions/deploy-cloud-functions@main'

2.  Checkout Github Repo
    - Run actions/checkout@v2
    - Getting Git version info
    - Initializing the repository
    - Setting up auth
    - Fetching the repository
    - Checking out the ref

3.  Deploy: run google-github-actions/deploy-cloud-functions
    - Setting project Id from $GCLOUD_PROJECT
    - Creating a function revision
    - Creating or Updating function deployment

4.  Test: run curl to the URL of the deployed Cloud Function service
    - Note: URL is only available with HTTP Trigger

## Setup

1.  Create a new Google Cloud Project (or select an existing project) and
    [enable the Cloud Functions APIs](https://console.cloud.google.com/flows/enableapi?apiid=cloudbuild.googleapis.com).

1.  [Create a Google Cloud service account][create-sa] if one does not already
    exist.

1.  Add the the following [Cloud IAM roles][roles] to your service account:

    - `Cloud Functions Admin` - allows for the creation of new functions

1.  [Download a JSON service account key][create-key] for the service account.

1.  Add the following secrets to your repository's secrets:

    - `GCP_SA_KEY`: the downloaded service account key

## Run the workflow

1.  Add and commit your changes:

    ```text
    $ git add .
    $ git commit -m "Set up GitHub workflow"
    ```

1.  Push to the `main` branch:

    ```text
    $ git push -u origin main
    ```

1.  View the GitHub Actions Workflow by selecting the `Actions` tab at the top
    of your repository on GitHub. Then click on the `Build and Deploy to Cloud
    Run` element to see the details.

[actions]: https://help.github.com/en/categories/automating-your-workflow-with-github-actions
[cloud-functions]: https://cloud.google.com/functions/
[create-sa]: https://cloud.google.com/iam/docs/creating-managing-service-accounts
[create-key]: https://cloud.google.com/iam/docs/creating-managing-service-account-keys
[sdk]: https://cloud.google.com/sdk
[secrets]: https://help.github.com/en/actions/automating-your-workflow-with-github-actions/creating-and-using-encrypted-secrets
[roles]: https://cloud.google.com/iam/docs/granting-roles-to-service-accounts#granting_access_to_a_service_account_for_a_resource
