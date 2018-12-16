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

// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

// [START ADMINS]
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

router.get('/createadmin',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {

        res.render('adminform.pug', {
            admin: {},
            action: 'Add'
        });
    }
);

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
        delete data['image'];
        getModel().createAdmin(data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect(req.baseUrl);
        });
    }
);

// delete admin from datastore
router.get('/:admin/deleteadmin', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().deleteAdmin(req.params.admin, (err) => {
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
        res.render('adminform.pug', {
            admin: entity,
            action: 'Update'
        });
    });
});

//update admin to datastore with post request
router.post('/:admin/updateadmin',
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
    }
);
// [END ADMINS]

// [START TOURNAMENTS]
router.get('/tournaments',
    oauth2.required,
    adminauth.required, (req, res, next) => {
        let games = {};
        let tournaments = {};
        getModel().listGames(null, null, (err, gameEntities, cursor) => {
            if (err) {
                next(err);
                return;
            }
            games = gameEntities;
            getModel().listTournaments(null, null, (err, tournamentEntities, cursor) => {
                tournaments = tournamentEntities;
                // add game to tournament. Since we already have the games, no need to call database
                for (let i = 0; i < tournaments.length; i++) {
                    let tournament = tournaments[i];
                    for (let j = 0; j < games.length; j++) {
                        let game = games[j];
                        if (tournament.game === game.id) {
                            tournament.game = game;
                        }
                    }
                }
                if (err) {
                    next(err);
                    return;
                }
                res.render('tournament.pug', {
                    games: games,
                    tournaments: tournaments,
                    admin: {}
                });
            });
        });
    }
);
// [START GAMES]
router.get('/creategame',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {
        res.render('gameform.pug', {
            admin: {},
            action: 'Add',
            game: {}
        });
    }
);

router.post('/creategame',
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
        delete data['image'];
        getModel().createGame(data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    });

// reads admin and redirects to update form
router.get('/:game/updategame', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().readGame(req.params.game, (err, entity) => {
        if (err) {
            next(err);
            return;
        }
        res.render('gameform.pug', {
            game: entity,
            action: 'Update'
        });
    });
});

//update admin to datastore with post request
router.post('/:game/updategame',
    oauth2.required,
    adminauth.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;
        const id = req.params.game;
        // Was an image uploaded? If so, we'll use its public URL
        // in cloud storage.
        if (req.file && req.file.cloudStoragePublicUrl) {
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
        }
        getModel().updateGame(id, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    }
);

// delete admin from datastore
router.get('/:game/deletegame', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().deleteGame(req.params.game, (err) => {
        if (err) {
            next(err);
            return;
        }
        res.redirect('/admin/tournaments');
    });
});
// [END GAMES]

router.get('/createtournament',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {
        getModel().listGames(null, null, (err, gameEntities, cursor) => {
            if (err) {
                next(err);
                return;
            }
            res.render('tournamentform.pug', {
                games: gameEntities,
                action: "Add",
                admin: {}
            });
        });
    }
);

router.post('/createtournament',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {
        const data = req.body;
        getModel().createTournament(data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    }
);

//TODO update and delete tournament

// [END TOURNAMENTS]
module.exports = router;
