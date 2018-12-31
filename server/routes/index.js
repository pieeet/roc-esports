const express = require('express');
const router = express.Router();
const oauth2 = require('../lib/oauth2');
// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);
const utils = require('../lib/utils');
const bodyParser = require('body-parser');
const images = require('../lib/images');

const KIND_GAME = "Game";
const KIND_TOURNAMENT = "Tournament";
const KIND_PLAYER = "Player";
const KIND_PLAYER_TOURNAMENT = "Player_Tournament";

// Automatically parse request body as form data
router.use(bodyParser.urlencoded({extended: false}));



// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
    // return require('../data/model-datastore'); // doet hetzelfde
}

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'roc-dev esports'});
});

/* GET subscribe page*/
router.get('/tournaments', (reg, res, next) => {
    let tournaments = {};
    getModel().listTournaments(null, null, Date.now(), (err, tournaments, cursor) => {
        if (err) {
            next(err);
            return;
        }
        if (!tournaments.length) {
            res.render('subscribelist.pug', {
                tournaments: tournaments
            });
        } else {
            for (let i = 0; i < tournaments.length; i++) {
                let tournament = tournaments[i];
                tournament.date = utils.prettyDate(new Date(tournament.starttime));
                tournament.starttime = utils.prettyTime(new Date(tournament.starttime));
                tournament.endtime = utils.prettyTime(new Date(tournament.endtime));


                // replace tournament.game (id only) with full game entity so we have game data
                let gameId = tournament.game;

                getModel().read(KIND_GAME, gameId, (err, entity) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    tournament.gamename = entity.name;
                    tournament.gameImg = entity.imageUrl;
                    if (i === tournaments.length - 1) {
                        res.render('subscribelist.pug', {
                            tournaments: tournaments
                        });
                    }
                });
            }
        }
    });
});

router.get('/:tournament/subscribe', oauth2.required, (req, res, next) => {
    // get the tournament
    getModel().read(KIND_TOURNAMENT, req.params.tournament, (err, ent) => {
        if (err) {
            next(err);
            return;
        }
        let tournament = ent;
        let start = new Date(tournament.starttime);
        let end = new Date(tournament.endtime);
        tournament.date = utils.prettyDate(start);
        tournament.starttime = utils.prettyTime(start);
        tournament.endtime = utils.prettyTime(end);

        //get the game associated with the tournament
        getModel().read(KIND_GAME, tournament.game, (err, ent) => {
            if (err) {
                next(err);
                return;
            }
            tournament.game = ent;
            // get the player profile associated with the logged in user
            getModel().getPlayer(req.user.email, null, null, (err, ent) => {
                if (err) {
                    next(err);
                    return;
                }
                // the query returns a list with one entity
                let player = ent[0];
                if (!player) {
                    player = {};
                } else {
                    if (player.token === "verified") {
                        player.verified = true;
                    }
                }
                let actionPlayer;
                // if existing player: set action update
                // else: set action create
                if (player.id) {
                    actionPlayer = "Update";
                } else {
                    actionPlayer = "Create";
                    // set player.id to avoid datastore crash @getSubscription()
                    player.id = null;
                }
                // check if player is subscribed to this tournament
                let subscriptionId;
                let actionTournament;
                getModel().getSubscription(tournament.id, player.id, (err, ent) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    if (ent === null || !ent.length) {
                        actionTournament = "Subscribe";
                        subscriptionId = null;
                    } else {
                        actionTournament = "Unsubscribe";
                        subscriptionId = ent[0].id;
                    }
                    // make a list of subscribers
                    getModel().getAttendees(tournament.id, (err, attendees) => {
                        res.render('subscribeform', {
                            tournament: tournament,
                            player: player,
                            actionplayer: actionPlayer,
                            actiontournament: actionTournament,
                            subscriptionId: subscriptionId,
                            attendees: attendees
                        });
                    });
                });
            });
        });
    });
});

router.post('/createplayer',
    oauth2.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;
        const tournament = data.tournament;
        delete data['tournament'];

        // Was an image uploaded? If so, we'll use its public URL
        // in cloud storage. Old file is deleted from storage.
        if (req.file && req.file.cloudStoragePublicUrl) {
            const oldImageUrl = data.imageUrl.valueOf();
            images.deleteImage(oldImageUrl);
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
        }
        // only store imageUrl, file is stored in GCS
        delete data['image'];
        data.email = req.user.email;
        const token = utils.makeVerificationToken(12);
        data.token = token;
        getModel().create(KIND_PLAYER, data, (err, cb) => {
            if (err) {
                next(err);
                return;
            }
            let isValid = utils.checkValidSchoolMail(data.schoolmail);
            let message = '';
            if (isValid) {
                utils.startVerification(data.schoolmail, token);
            } else {
                message = "You've entered a non-valid email address, please try again";
            }
            res.render(`emailsent`, {
                player: data,
                message: message
            });
        });
    }
);

router.post('/updateplayer',
    oauth2.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;
        // Was an image uploaded? If so, we'll use its public URL
        // in cloud storage. Old file is deleted from storage.
        let imgChanged = false;
        if (req.file && req.file.cloudStoragePublicUrl) {
            const oldImageUrl = data.imageUrl.valueOf();
            images.deleteImage(oldImageUrl);
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
            imgChanged = true;
        }
        // get the player to maintain its current properties. Update is same as create
        // in datastore except its id stays the same
        getModel().read(KIND_PLAYER, data.playerid, (err, player) => {
            if (err) {
                next(err);
                return;
            }
            // change its relevant properties
            player.playername = data.playername;
            if (imgChanged) {
                player.imageUrl = req.body.imageUrl;
            }
            let emailsent = false;
            let message = '';
            // not yet verified and user changed his schoolmail --> resend verification mail
            if (player.token !== 'verified' && data.schoolmail !== player.schoolmail) {
                if (utils.checkValidSchoolMail(data.schoolmail)) {
                    utils.sendVerificationEmail(data.schoolmail, player.token);
                    emailsent = true;
                    player.schoolmail = data.schoolmail;
                } else {
                    message = "You've entered a non-valid email address, please try again";
                }
            }
            getModel().update(KIND_PLAYER, player.id, player, (err, cb) => {
                if (err) {
                    next(err);
                    return;
                }
                // if an email is sent, notify player
                if (emailsent) {
                    res.render(`emailsent`, {
                        player: data,
                        message: message
                    });

                } else {
                    res.redirect(`/${data.tournament}/subscribe`);
                }
            });
        });
    }
);

router.post('/:tournament/subscribe', oauth2.required, (req, res, next) => {
    const data = req.body;
    const tournamentId = data.tournament_id;
    if (data.subscription_id) {
        const subscriptionId = data.subscription_id;
        getModel().delete(KIND_PLAYER_TOURNAMENT, subscriptionId, (err, cb) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect(`/${tournamentId}/subscribe`);
        });
    } else {
        getModel().create(KIND_PLAYER_TOURNAMENT, data, (err, cb) => {
            if (err) {
                next(err);
                return;
            }
            res.redirect(`/${tournamentId}/subscribe`);
        });
    }
});

module.exports = router;
