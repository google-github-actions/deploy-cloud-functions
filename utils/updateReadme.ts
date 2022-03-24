import * as fs from 'fs';

/**
 * Script to Update Readme with Event Trigger Types from gcloud output
 * table returns three columns: event type, resource name, and resource collection
 *
 * gcloud step writes results to json file -> read json file and parse into a string row
 * formmated for a row in a markdown table for each relevant event type -> reads existing markdown doc
 * and replaces the substring between markers with the updated data
 */

const markdownTable = `
| Event Type | Resource Name | Resource Collection |
| ---------- | ------------- | ------------------- | \n`;

const startMarker = '<!-- Start: DO NOT EDIT -->';
const endMarker = '<!-- End: DO NOT EDIT -->';

const readEventData = async (): Promise<string> => {
  const eventTypesData = fs.readFileSync('./events.json');
  const markdownArray: string[] = [];
  markdownArray.push(markdownTable);
  // TODO find exportable type for gcloud output
  JSON.parse(eventTypesData.toString()).forEach((data: any) => {
    if (data.label && data.resource_type.name && data.resource_type.value.collection_id) {
      const stringToAdd = `| ${data.label} | ${data.resource_type.name} | ${data.resource_type.value.collection_id} | \n`;
      markdownArray.push(stringToAdd);
    }
  });
  const newTable = markdownArray.join('');
  return newTable;
};

const updateReadMe = async (): Promise<void> => {
  const eventData = await readEventData();
  fs.readFile('./docs/eventTriggerTypes.md', (err, data) => {
    const currentMarkdown = data.toString();
    const startMarkerIndex = currentMarkdown.indexOf(startMarker);
    const endMarkerIndex = currentMarkdown.indexOf(endMarker);
    // grab substring between start and end markers
    // replace with updated event types table
    const newData = currentMarkdown.replace(
      currentMarkdown.substring(startMarkerIndex + startMarker.length, endMarkerIndex - 1),
      eventData,
    );
    fs.writeFileSync('./docs/eventTriggerTypes.md', newData);
  });
};

updateReadMe();
