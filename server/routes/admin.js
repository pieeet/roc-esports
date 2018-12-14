const express = require('express');
const images = require('../lib/images');
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

router.get('/createadmin',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {

        res.render('adminform.pug', {
            admin: {},
            action: 'Add'
        });
    });

//add admin to datastore
router.post('/createadmin',
    oauth2.required,
    adminauth.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;

        // Was an image uploaded? If so, we'll use its public URL
        // in cloud storage.
        if (req.file && req.file.cloudStoragePublicUrl) {
            data.imageUrl = req.file.cloudStoragePublicUrl;
        }

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
router.get('/:admin/createadmin', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().readAdmin(req.params.admin, (err, entity) => {
        if (err) {
            next(err);
            return;
        }
        res.render('adminform.pug', {
            admin: entity,
            action: 'Update'
        });
    });
});

//update admin to datastore with post request
router.post('/:admin/createadmin',
    oauth2.required,
    adminauth.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;
        const id = req.params.admin;
        // Was an image uploaded? If so, we'll use its public URL
        // in cloud storage.
        if (req.file && req.file.cloudStoragePublicUrl) {
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
        }
        getModel().updateAdmin(id, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin');
        });
    });

module.exports = router;
