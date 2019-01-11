# E-Sports Project

## Setup

This app is built to be deployed on Google Cloud Platform's [`App Engine`](https://cloud.google.com/appengine/) with `datastore` as 
its database. 
Before you can run or deploy the sample, we advise you to follow the excellent 
[node.js bookshelf tutorial](https://cloud.google.com/nodejs/getting-started/tutorial-app) 
from Google if you're not familiar with using App Engine with node.js.

You should create your own `config.json` file containing your project 
credentials and private keys. and add it to the root of your project. The file should at least contain:
- `"GCLOUD_PROJECT"`: `"[your project-id]"`,
- `"DATA_BACKEND"`: `"datastore"`,
- `"OAUTH2_CLIENT_ID"`: `"[YOUR CLIENT ID]"`,
- `"OAUTH2_CLIENT_SECRET"`: `"[YOUR CLIENT SECRET]"`,
- `"OAUTH2_CALLBACK"`: `"localhost:3000/auth/google/callback"`,
- `"CLOUD_BUCKET"`: `"[YOUR CLOUD BUCKET NAME]"`,
- `"SECRET"`: `"[SOME RANDOM STRING]"`,
- `"SENDGRID_API_KEY"`: `"YOUR API KEY FROM SENDGRID"`,
- `"EMAIL_FROM"`: `"YOUR FROM EMAIL"`

Before you deploy to app engine change `OAUTH2CALLBACK` `localhost:3000` with your url
1.  Install dependencies:

    With `npm`:

        npm install

    or with `yarn`:

        yarn install

## Running locally

With `npm`:

    npm start

or with `yarn`:

    yarn start

## Deploying to App Engine

With `npm`:

    npm run deploy

or with `yarn`:

    yarn run deploy

