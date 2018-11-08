'use strict';

const express = require('express');
const router = express.Router();

function getModel() {
    return require(`../data/model-${require('../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
    // return require('../esports/model-datastore'); // doet hetzelfde
}

// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/json');
    next();
});

/**
 * GET /api/admins
 * mainly for testing purposes
 * Retrieve a page with admins in json format up to ten at a time).
 */
router.get('/getAdmins', (req, res, next) => {
    //return 10 admins in json format
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