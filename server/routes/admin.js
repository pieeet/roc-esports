const express = require('express');
const images = require('../lib/images');
const router = express.Router();

const bodyParser = require('body-parser');
const oauth2 = require('../lib/oauth2');
const adminauth = require('../lib/adminauth');
const moment = require('moment-timezone');
const utils = require('../lib/utils');
moment.tz.setDefault('Europe/Amsterdam');

// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);

const KIND_ADMIN = "Admin";
const KIND_GAME = "Game";
const KIND_TOURNAMENT = "Tournament";

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
        getModel().create(KIND_ADMIN, data, (err, savedData) => {
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
    getModel().delete(KIND_ADMIN, req.params.admin, (err) => {
        if (err) {
            next(err);
            return;
        }
        res.redirect(req.baseUrl);
    });
});

// reads admin and redirects to update form
router.get('/:admin/updateadmin', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().read(KIND_ADMIN, req.params.admin, (err, entity) => {
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
            const oldImageUrl = data.imageUrl.valueOf();
            images.deleteImage(oldImageUrl);
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
        }
        getModel().update(KIND_ADMIN, id, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin');
        });
    }
);
// [END ADMINS]


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
        getModel().create(KIND_GAME, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    });

// reads admin and redirects to update form
router.get('/:game/updategame', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().read(KIND_GAME, req.params.game, (err, entity) => {
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
            const oldImageUrl = data.imageUrl.valueOf();
            images.deleteImage(oldImageUrl);
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
        }
        getModel().update(KIND_GAME, id, data, (err, savedData) => {
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
    getModel().delete(KIND_GAME, req.params.game, (err) => {
        if (err) {
            next(err);
            return;
        }
        res.redirect('/admin/tournaments');
    });
});
// [END GAMES]

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
            getModel().listTournaments(null, null, 0, (err, tournamentEntities, cursor) => {
                tournaments = tournamentEntities;
                // add game to tournament. Since we already have the games, no need to call database
                for (let i = 0; i < tournaments.length; i++) {
                    let tournament = tournaments[i];

                    tournament.date = utils.prettyDate(new Date(tournament.starttime));
                    tournament.starttime = utils.prettyTime(new Date(tournament.starttime));
                    tournament.endtime = utils.prettyTime(new Date(tournament.endtime));

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
                admin: {},
                tournament: {}
            });
        });
    }
);

router.post('/createtournament',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {
        const data = req.body;
        //interpret entry dates from dutch timezone
        let starttime = moment.tz(data.date + 'T' + data.starttime, 'Europe/Amsterdam');
        let endtime = moment.tz(data.date + 'T' + data.endtime, 'Europe/Amsterdam');
        // no need to store date
        delete data['date'];
        // save date as utc
        data['starttime'] = starttime.utc().valueOf();
        data['endtime'] = endtime.utc().valueOf();

        getModel().create(KIND_TOURNAMENT, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    }
);

// reads admin and redirects to update form
router.get('/:tournament/updatetournament', oauth2.required, adminauth.required, (req, res, next) => {
    let tournament = {};
    let games = {};
    getModel().read(KIND_TOURNAMENT, req.params.tournament, (err, entity) => {
            if (err) {
                next(err);
                return;
            }
            tournament = entity;
            tournament.date = utils.prettyDate(new Date(tournament.starttime));
            tournament.starttime = utils.prettyTime(new Date(tournament.starttime));
            tournament.endtime = utils.prettyTime(new Date(tournament.endtime));

            getModel().listGames(null, null, (err, gameEntities, cursor) => {
                if (err) {
                    next(err);
                    return;
                }
                res.render('tournamentform.pug', {
                    games: gameEntities,
                    action: "Update",
                    tournament: tournament,
                    admin: {}
                });
            });
        }
    );
});

//update admin to datastore with post request
router.post('/:tournament/updatetournament',
    oauth2.required,
    adminauth.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;
        const id = req.params.tournament;
        let starttime = moment.tz(data.date + 'T' + data.starttime, 'Europe/Amsterdam');
        let endtime = moment.tz(data.date + 'T' + data.endtime, 'Europe/Amsterdam');
        // no need to store date
        delete data['date'];
        // save date as utc timestamp
        data['starttime'] = starttime.utc().format();
        data['endtime'] = endtime.utc().format();

        getModel().update(KIND_TOURNAMENT, id, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    }
);

// delete admin from datastore
router.get('/:tournament/deletetournament', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().delete(KIND_TOURNAMENT, req.params.tournament, (err) => {
        if (err) {
            next(err);
            return;
        }
        res.redirect('/admin/tournaments');
    });
});


// [END TOURNAMENTS]
module.exports = router;
