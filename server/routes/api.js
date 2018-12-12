'use strict';

const express = require('express');
const router = express.Router();

var cors = require('cors');

router.use(cors());


function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
    // return require('../data/model-datastore'); // doet hetzelfde
}

// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/json');
    next();
});

/**
 * GET /api/getadmins
 * mainly for testing purposes
 * Retrieve a page with admins in json format.
 */
router.get('/getAdmins', (req, res, next) => {
    //return admins in json format
    getModel().listAdmins(null, null, (err, entities, cursor) => {
        if (err) {
            next(err);
            return;
        }
        res.json({
            items: entities,
            nextPageToken: cursor
        });
    });
});
module.exports = router;