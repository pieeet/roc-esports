const express = require('express');
const router = express.Router();

const bodyParser = require('body-parser');
const oauth2 = require('../lib/oauth2');

// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);

function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
    // return require('../data/model-datastore'); // doet hetzelfde
}

// Automatically parse request body as form data
router.use(bodyParser.urlencoded({extended: false}));

function checkIfAdmin(email, cb) {
    getModel().listAdmins(null, null, (err, entities, cursor) => {
        if (err) {
            next(err);
            return;
        }
        let isAdmin = false;
        for (let i = 0; i < entities.length; i++) {
            if (email === entities[i].email) {
                isAdmin = true;
            }
        }
        cb(null, isAdmin);
    });
}

/* GET admin page. */
router.get('/', oauth2.required, (req, res, next) => {
    checkIfAdmin(req.user.email, (err, isAdmin) => {
        if (isAdmin) {
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
        } else {
            return res.redirect('/auth/logout');
        }
    });
});


// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

//add admin to datastore
router.post('/createadmin', oauth2.required, (req, res, next) => {
    checkIfAdmin(req.user.email, (err, isAdmin) => {
        if (isAdmin) {
            // const data = req.body;
            let data = {};
            data.name = req.body.name;
            data.email = req.body.email;
            data.added_by = req.user.displayName;
            data.date_added = new Date();
            getModel().createAdmin(data, (err, savedData) => {
                if (err) {
                    next(err);
                    return;
                }
                res.redirect(req.baseUrl);
            });
        }
    });
});
// delete admin from datastore
router.get('/:admin/deleteadmin',oauth2.required, (req, res, next) => {
    checkIfAdmin(req.user.email, (err, isAdmin) => {
        if (isAdmin) {
            getModel().delete(req.params.admin, (err) => {
                if (err) {
                    next(err);
                    return;
                }
                res.redirect(req.baseUrl);
            });
        }
    });
});

module.exports = router;
