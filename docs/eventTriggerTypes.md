# Cloud Function Event Trigger Types

#### The table below follows `gcloud's` release schedule, and updates the available event trigger types on a weekly basis. The follow command can also be run from the command line with `gcloud` installed and it will fetch back the same results:

&nbsp;

```
$ gcloud functions event-types list
```

&nbsp;

## Event Type & Resource Name/Collection:

&nbsp;

<!-- Start: DO NOT EDIT -->
| Event Type | Resource Name | Resource Collection |
| ---------- | ------------- | ------------------- | 
| google.pubsub.topic.publish | TOPIC | pubsub.projects.topics | 
| providers/cloud.pubsub/eventTypes/topic.publish | TOPIC | pubsub.projects.topics | 
| google.storage.object.finalize | BUCKET | cloudfunctions.projects.buckets | 
| providers/cloud.storage/eventTypes/object.change | BUCKET | cloudfunctions.projects.buckets | 
| google.storage.object.archive | BUCKET | cloudfunctions.projects.buckets | 
| google.storage.object.delete | BUCKET | cloudfunctions.projects.buckets | 
| google.storage.object.metadataUpdate | BUCKET | cloudfunctions.projects.buckets | 
| providers/google.firebase.database/eventTypes/ref.create | FIREBASE_DB | google.firebase.database.ref | 
| providers/google.firebase.database/eventTypes/ref.update | FIREBASE_DB | google.firebase.database.ref | 
| providers/google.firebase.database/eventTypes/ref.delete | FIREBASE_DB | google.firebase.database.ref | 
| providers/google.firebase.database/eventTypes/ref.write | FIREBASE_DB | google.firebase.database.ref | 
| providers/cloud.firestore/eventTypes/document.create | FIRESTORE_DOC | google.firestore.document | 
| providers/cloud.firestore/eventTypes/document.update | FIRESTORE_DOC | google.firestore.document | 
| providers/cloud.firestore/eventTypes/document.delete | FIRESTORE_DOC | google.firestore.document | 
| providers/cloud.firestore/eventTypes/document.write | FIRESTORE_DOC | google.firestore.document | 
| providers/google.firebase.analytics/eventTypes/event.log | FIREBASE_ANALYTICS_EVENT | google.firebase.analytics.event | 
| google.firebase.remoteconfig.update | PROJECT | cloudresourcemanager.projects | 
| providers/firebase.auth/eventTypes/user.create | PROJECT | cloudresourcemanager.projects | 
| providers/firebase.auth/eventTypes/user.delete | PROJECT | cloudresourcemanager.projects | 

<!-- End: DO NOT EDIT -->
