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

const KIND_GAME = "Game";
const KIND_TOURNAMENT = "Tournament";
const KIND_PLAYER_TOURNAMENT = "Player_Tournament";

function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`);
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
    getModel().listAdmins(null, null, 1, (err, entities, cursor) => {
        if (err) {
            next(err);
            return;
        }
        res.render('admin/admin', {
            title: 'roc-dev esports',
            admins: entities
        });
    });
});

// [START GAMES]
router.get('/creategame',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {
        res.render('admin/gameform.pug', {
            action: 'Create',
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
        data.teamsize = parseInt(data.teamsize, 10);
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

// reads game and redirects to update form
router.get('/:game/updategame', oauth2.required, adminauth.required, (req, res, next) => {
    getModel().read(KIND_GAME, req.params.game, (err, entity) => {
        if (err) {
            next(err);
            return;
        }
        res.render('admin/gameform.pug', {
            game: entity,
            action: 'Update'
        });
    });
});

//update game to datastore with post request
router.post('/:game/updategame',
    oauth2.required,
    adminauth.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        let admin = req.admin;
        if (admin.role >= 4) {
            const data = req.body;
            data.teamsize = parseInt(data.teamsize, 10);
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
        } else {
            res.redirect('/admin/tournaments');
        }

    }
);
// [END GAMES]

// [START TOURNAMENTS]
router.get('/tournaments',
    oauth2.required,
    adminauth.required, (req, res, next) => {
        let admin = req.admin;
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
                res.render('admin/tournament.pug', {
                    games: games,
                    tournaments: tournaments,
                    admin: admin
                });
            });
        });
    }
);

router.get('/createtournament',
    oauth2.required,
    adminauth.required,
    (req, res, next) => {
        let admin = req.admin;
        let tournament = {};
        //form needs a game property
        tournament.game = {};
        getModel().listGames(null, null, (err, gameEntities, cursor) => {
            if (err) {
                next(err);
                return;
            }
            res.render('admin/tournamentform.pug', {
                games: gameEntities,
                action: "Create",
                tournament: tournament,
                admin: admin
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
        let endreg = moment.tz(data.endreg + 'T' + '00:00', 'Europe/Amsterdam');
        // no need to store date
        delete data['date'];
        // save date as utc
        data['starttime'] = starttime.utc().valueOf();
        data['endtime'] = endtime.utc().valueOf();
        data['endreg'] = endreg.utc().valueOf();

        getModel().create(KIND_TOURNAMENT, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    }
);

// reads tournament and redirects to update form
router.get('/:tournament/updatetournament', oauth2.required, adminauth.required, (req, res, next) => {
    let tournament = {};
    getModel().read(KIND_TOURNAMENT, req.params.tournament, (err, entity) => {
        if (err) {
            next(err);
            return;
        }
        tournament = entity;
        tournament.date = utils.prettyDate(new Date(tournament.starttime));
        tournament.starttime = utils.prettyTime(new Date(tournament.starttime));
        tournament.endtime = utils.prettyTime(new Date(tournament.endtime));
        tournament.endreg = utils.prettyDate(new Date(tournament.endreg));

        getModel().listGames(null, null, (err, gameEntities, cursor) => {
            if (err) {
                next(err);
                return;
            }
            for (let i = 0; i < gameEntities.length; i++) {
                if (gameEntities[i].id === tournament.game) {
                    tournament.game = gameEntities[i];
                }

                if (i === gameEntities.length - 1) {
                    console.log(tournament.game);
                    res.render('admin/tournamentform.pug', {
                        games: gameEntities,
                        action: "Update",
                        tournament: tournament
                    });
                }
            }
        });
    });
});

//update tournament to datastore with post request
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
        let endreg = moment.tz(data.endreg + 'T' + '00:00', 'Europe/Amsterdam');
        // no need to store date
        delete data['date'];
        // save date as utc timestamp
        data['starttime'] = starttime.utc().valueOf();
        data['endtime'] = endtime.utc().valueOf();
        data['endreg'] = endreg.utc().valueOf();

        getModel().update(KIND_TOURNAMENT, id, data, (err, savedData) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect('/admin/tournaments');
        });
    }
);

// check in players or teams for tournament
router.get('/:tournament/checkin', oauth2.required, adminauth.required, (req, res, next) => {
    const tournamentId = req.params.tournament;
    getModel().read(KIND_TOURNAMENT, tournamentId, (err, tournament) => {
        getModel().read(KIND_GAME, tournament.game, (err, game) => {
            const isTeamGame = game.teamsize > 1;
            getModel().getAttendees(tournamentId, isTeamGame, (err, attendees) => {
                if (err) {
                    next(err);
                    return;
                }
                // sort on playername
                attendees.sort(function (a, b) {
                    return (a.playername.toLowerCase() > b.playername.toLowerCase()) ? 1 :
                        ((b.playername.toLowerCase() > a.playername.toLowerCase()) ? -1 : 0);
                });

                res.render('admin/checkinlist', {
                    attendees: attendees,
                    tournamentId: tournamentId
                });
            });
        });
    });
});

router.get('/:tournament/remove-no-show', oauth2.required, adminauth.required, (req, res, next) => {
    const tournamentId = req.params.tournament;
    getModel().removeNoShows(tournamentId, (err, cb) => {
        if (err) {
            next(err);
            return;
        }
        if (cb === 200) {
            res.redirect(`/admin/${tournamentId}/checkin`)
        }
    });


});


router.post('/:tournament/checkin', oauth2.required, adminauth.required, (req, res, next) => {
    const data = req.body;
    const tournamentId = req.params.tournament;
    const subscriptionId = data.subscriptionid;
    getModel().read(KIND_PLAYER_TOURNAMENT, subscriptionId, (err, subscription) => {
        if (subscription.checkedin) {
            delete subscription.checkedin;
        } else {
            subscription.checkedin = true;
        }
        // remove id property to avoid saving id separately
        delete subscription.id;
        getModel().update(KIND_PLAYER_TOURNAMENT, subscriptionId, subscription, (err, cb) => {
            if (err) {
                next(err);
                return;
            }
            // give datastore some time to process the update
            setTimeout(() => {
                res.redirect(`/admin/${tournamentId}/checkin`);
            }, 300);
        });
    });
});


// [END TOURNAMENTS]
module.exports = router;
