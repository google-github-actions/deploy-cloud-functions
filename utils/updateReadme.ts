import * as core from '@actions/core';
import * as toolCache from '@actions/tool-cache';
import * as setupGcloud from '@google-github-actions/setup-cloud-sdk';
import path from 'path';
import * as Moustache from 'mustache';
import * as fs from 'fs';

interface GcloudResponseObject {
  output: string; // stringified json object
  commandString: string; // the gcloud command string to be run
}

const setupGcloudSDK = async (): Promise<GcloudResponseObject> => {
  try {
    const cmd = ['functions', 'event-types', 'list', '--format', 'json'];
    // Setup latest Gcloud Version
    const gcloudVersion = await setupGcloud.getLatestGcloudSDKVersion();

    if (!setupGcloud.isInstalled(gcloudVersion)) {
      await setupGcloud.installGcloudSDK(gcloudVersion);
    } else {
      const toolPath = toolCache.find('gcloud', gcloudVersion);
      core.addPath(path.join(toolPath, 'bin'));
    }
    await setupGcloud.authenticateGcloudSDK();
    const authenticated = await setupGcloud.isAuthenticated();
    if (!authenticated) {
      throw new Error('Error authenticating the Cloud SDK.');
    }
    const toolCommand = setupGcloud.getToolCommand();
    const commandString = `${toolCommand} ${cmd.join(' ')}`;
    // Print command string for logging
    core.info(`Running: ${commandString}`);
    // Run gcloud cmd.
    const { output } = await setupGcloud.gcloudRun(cmd);
    return {
      output: output,
      commandString: commandString,
    };
  } catch (e) {
    throw new Error('There was an error setting up Gcloud SDK. Full error: ' + e);
  }
};

// type definitions for data written to readme
interface EventTypes {
  event_type: string; // the event type the cloud function can listen to
  resource_name: string; // the name of the google cloud resource triggering that event
  resource_collection: string; // the resource collection
}

const generateReadMe = async (): Promise<void> => {
  const event_types: EventTypes[] = [];
  const { output, commandString } = await setupGcloudSDK();
  try {
    // TODO: find type for glcoud output
    JSON.parse(output).forEach((data: any) => {
      if (data.label && data.resource_type.name && data.resource_type.value.collection_id) {
        event_types.push({
          event_type: data.label,
          resource_name: data.resource_type.name,
          resource_collection: data.resource_type.value.collection_id,
        });
      } else {
        throw new Error(`Response body changed for command: ${commandString}.`);
      }
    });
    // remove duplicate events from gcloud output
    const uniqueEvents = new Set(event_types);
    const eventTriggerData = {
      events: Array.from(uniqueEvents),
    };
    // read moustache template and write new readme to be commited
    fs.readFile('./main.moustache', (err, data) => {
      if (err)
        throw new Error(`There was an error reading the moustache file template. Error: ${err}`);
      const output = Moustache.render(data.toString(), eventTriggerData);
      fs.writeFileSync('../READMETEST.md', output);
    });
  } catch (e) {
    throw new Error(
      `There was an error generating readme. Check gcloud command response output. Full error: ${e}`,
    );
  }
};

generateReadMe();
