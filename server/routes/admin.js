const express = require('express');
const router = express.Router();

const bodyParser = require('body-parser');
const oauth2 = require('../lib/oauth2');
const adminauth = require('../lib/adminauth');

// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);

function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
    // return require('../data/model-datastore'); // doet hetzelfde
}

// Automatically parse request body as form data
router.use(bodyParser.urlencoded({extended: false}));

/* GET admin page. */
router.get('/', oauth2.required, adminauth.required, (req, res, next) => {
    // get admins
    getModel().listAdmins(null, null, (err, entities, cursor) => {
        if (err) {
            next(err);
            return;
        }
        res.render('admin', {
            title: 'roc-dev esports',
            admins: entities
        });

    });
});


// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

//add admin to datastore
router.post('/createadmin', oauth2.required, adminauth.required, (req, res, next) => {
    const data = req.body;
    // let data = {};
    // data.name = req.body.name;
    // data.email = req.body.email;
    // data.added_by = req.user.displayName;
    // data.date_added = new Date();
    getModel().createAdmin(data, (err, savedData) => {
        if (err) {
            next(err);
            return;
        }
        res.redirect(req.baseUrl);
    });
});
// delete admin from datastore
router.get('/:admin/deleteadmin', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().delete(req.params.admin, (err) => {
        if (err) {
            next(err);
            return;
        }
        res.redirect(req.baseUrl);
    });
});

// reads admin and redirects to update form
router.get('/:admin/updateadmin', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().readAdmin(req.params.admin, (err, entity) => {
        if (err) {
            next(err);
            return;
        }
        res.render('updateAdmin', {
            admin: entity
        });
    });
});

//update admin to datastore with post request
router.post('/:admin/updateadmin', oauth2.required, adminauth.required, (req, res, next) => {
    const data = req.body;
    const id = req.params.admin;
    getModel().updateAdmin(id, data, (err, savedData) => {
        if (err) {
            next(err);
            return;
        }
        res.redirect('/admin');
    });
});

module.exports = router;
