'use strict';

const Storage = require('@google-cloud/storage');
const config = require('../../config');

const CLOUD_BUCKET = config.get('CLOUD_BUCKET');

const storage = Storage({
    projectId: config.get('GCLOUD_PROJECT')
});

function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
    // return require('../data/model-datastore'); // doet hetzelfde
}

const bucket = storage.bucket(CLOUD_BUCKET);

// Returns the public, anonymously accessable URL to a given Cloud Storage
// object.
// The object's ACL has to be set to public read.
function getPublicUrl(filename) {
    return `https://storage.googleapis.com/${CLOUD_BUCKET}/${filename}`;
}

// Express middleware that will automatically pass uploads to Cloud Storage.
// req.file is processed and will have two new properties:
// * ``cloudStorageObject`` the object name in cloud storage.
// * ``cloudStoragePublicUrl`` the public url to the object.
function sendUploadToGCS(req, res, next) {
    if (!req.file) {
        return next();
    }
    const gcsname = Date.now() + req.file.originalname;
    const file = bucket.file(gcsname);
    const stream = file.createWriteStream({
        metadata: {
            contentType: req.file.mimetype
        },
        resumable: false
    });

    stream.on('error', (err) => {
        req.file.cloudStorageError = err;
        next(err);
    });

    stream.on('finish', () => {
        req.file.cloudStorageObject = gcsname;
        file.makePublic().then(() => {
            req.file.cloudStoragePublicUrl = getPublicUrl(gcsname);
            next();
        });
    });

    stream.end(req.file.buffer);
}

// Multer handles parsing multipart/form-data requests.
// This instance is configured to store images in memory.
// This makes it straightforward to upload to Cloud Storage.
const Multer = require('multer');
const mimeTypesFilter = require('@meanie/multer-mime-types-filter');
const mimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
const multer = Multer({
    storage: Multer.MemoryStorage,
    fileFilter: mimeTypesFilter(mimeTypes),
    limits: {
        fileSize: 5 * 1024 * 1024 // no larger than 5mb
    },
});

// see https://cloud.google.com/storage/docs/deleting-objects
async function deleteImage(imageUrl) {
    if (imageUrl.length) {
        const arr = imageUrl.split('/');
        const filename = arr.pop();

        // Deletes the file from the bucket
        await storage
            .bucket(CLOUD_BUCKET)
            .file(filename)
            .delete();
    }
}

module.exports = {
    getPublicUrl,
    sendUploadToGCS,
    deleteImage,
    multer
};
