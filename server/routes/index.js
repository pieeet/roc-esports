const express = require('express');
const router = express.Router();
const oauth2 = require('../lib/oauth2');
// Use the oauth2 middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);
// Use the 'verified' middleware to automatically get the player's profile if verified is required
const verified = require('../lib/verified');
const utils = require('../lib/utils');
const emailutils = require('../lib/emailutils');
const bodyParser = require('body-parser');
const images = require('../lib/images');

const KIND_GAME = "Game";
const KIND_TOURNAMENT = "Tournament";
const KIND_PLAYER = "Player";
const KIND_PLAYER_TOURNAMENT = "Player_Tournament";

const MIN_NAME = 5;
const MAX_NAME = 13;

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


router.get('/profile', oauth2.required, (req, res, next) => {
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
            }
            res.render('profile', {
                player: player,
                action: actionPlayer
            })
        }
    )
});

function sanitizeProfileData(data) {
    data.playername = data.playername.trim();
    if (data.schoolmail) {
        data.schoolmail = data.schoolmail.trim();
    }
    return data;
}

router.post('/createplayer',
    oauth2.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        let data = req.body;
        data = sanitizeProfileData(data);
        console.log(data.playername.length);
        if (data.playername.length < MIN_NAME || data.playername.length > MAX_NAME) {
            res.render(`profileformconfirm`, {
                player: data,
                message: 'Player name too short. '
            });
            return;
        }
        if (!emailutils.checkValidSchoolMail(data.schoolmail)) {
            res.render(`profileformconfirm`, {
                player: data,
                message: 'Schoolmail not valid. '
            });
            return;
        }

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

        data.role = 0;
        let errorMessage = '';
        // check if the schoolmail isn't already in use
        getModel().schoolmailAvailable(data.schoolmail, (err, available) => {
            if (err) {
                next(err);
                return;
            }
            if (available) {
                getModel().playernameAvailable(data.playername, (err, available) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    if (available) {
                        const token = utils.makeVerificationToken(12);
                        data.token = token;
                        getModel().create(KIND_PLAYER, data, (err, cb) => {
                            if (err) {
                                next(err);
                                return;
                            }
                            // send verification to schoolmail
                            emailutils.startVerification(data.schoolmail, token);
                            // send welcome message to gmail for whitelisting
                            emailutils.sendWelcomeEmail(data.email);
                            res.render(`profileformconfirm`, {
                                player: data,
                                message: errorMessage
                            });
                        });
                    } else {
                        errorMessage = 'Your chosen player name is already taken.';
                        res.render(`profileformconfirm`, {
                            player: data,
                            message: errorMessage
                        });
                    }
                });
            } else {
                errorMessage = "The schoolmail address you've entered is already in use.";
                res.render(`profileformconfirm`, {
                    player: data,
                    message: errorMessage
                });
            }
        });
    }
);

router.post('/updateplayer',
    oauth2.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        let data = req.body;
        data = sanitizeProfileData(data);
        // Was an image uploaded? If so, we'll use its public URL
        // in cloud storage. Old file is deleted from storage.
        let imgChanged = false;
        if (req.file && req.file.cloudStoragePublicUrl) {
            const oldImageUrl = data.imageUrl.valueOf();
            images.deleteImage(oldImageUrl);
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
            imgChanged = true;
        }
        const id = data.playerid.valueOf();
        delete data.playerid;
        getModel().read(KIND_PLAYER, id, (err, player) => {
            if (err) {
                next(err);
                return;
            }
            // avoid id being separately stored
            delete player.id;
            //player changed image
            if (imgChanged) {
                player.imageUrl = req.body.imageUrl;
            }
            // if schoolmail was sent, user is not yet verified. Don't bother with name field
            // or it gets too complicated
            if (data.schoolmail) {
                // [START UPDATE SCHOOLMAIL]
                // user changed his schoolmail
                if (data.schoolmail !== player.schoolmail) {
                    // not valid... abort
                    if (!utils.checkValidSchoolMail(data.schoolmail)) {
                        return res.render(`profileformconfirm`, {
                            player: data,
                            message: 'Provided email is invalid.'
                        });
                    }
                    // email is valid check available
                    getModel().schoolmailAvailable(data.schoolmail, (err, available) => {
                        if (available) {
                            // same token different email
                            emailutils.startVerification(data.schoolmail, player.token);
                            player.schoolmail = data.schoolmail;
                            getModel().update(KIND_PLAYER, id, player, (err, cb) => {
                                if (err) {
                                    next(err);
                                    return;
                                }
                                return res.render(`profileformconfirm`, {
                                    player: player,
                                    message: ''
                                });
                            });
                        // email not available
                        } else {
                            res.render(`profileformconfirm`, {
                                player: player,
                                message: 'School mail address already in use'
                            });
                        }
                    });
                }
                // nothing changed just resend the verification email
                else {
                    emailutils.startVerification(player.schoolmail, player.token);
                    return res.render(`profileformconfirm`, {
                        player: player,
                        message: ''
                    });
                } // [END UPDATE SCHOOLMAIL]
            // schoolmail is not in form-data meaning player is already verified
            } else {
                // player changed name
                if (data.playername !== player.playername) {
                    // [START NAME CHANGE]
                    //name has changed verify validity
                    if (data.playername.length < MIN_NAME || data.playername.length > MAX_NAME) {
                        return res.render(`profileformconfirm`, {
                            player: data,
                            message: 'Provided name is too short.'
                        });
                    } else {
                        // verify availability
                        getModel().playernameAvailable(data.playername, (err, available) => {
                            if (available) {
                                //verander naam player
                                player.playername = data.playername;
                                getModel().update(KIND_PLAYER, id, player, (err, cb) => {
                                    if (err) {
                                        next(err);
                                        return;
                                    }
                                    return res.redirect('/profile');
                                });
                            // name not available
                            } else {
                                return res.render(`profileformconfirm`, {
                                    player: player,
                                    message: `${data.playername} is not available.`
                                });
                            }
                        });
                    }
                } // [END NAME CHANGE]
                // player only changed img
                else if (imgChanged) {
                    getModel().update(KIND_PLAYER, id, player, (err, cb) => {
                        if (err) {
                            next(err);
                            return;
                        }
                        return res.redirect('/profile');
                    });

                }
                //player clicked button but nothing changed. Just redirect.
                else {
                    return res.redirect('/profile');
                }
            }
        });
    }
);


router.get('/:tournament/subscribe',
    oauth2.required,
    verified.required,
    (req, res, next) => {
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
                // get player from request. This is guaranteed because verified.required
                let player = req.player;
                // check if user is subscribed
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
                            actiontournament: actionTournament,
                            subscriptionId: subscriptionId,
                            attendees: attendees
                        });
                    });
                });

            });
        });
    }
);

router.post('/:tournament/subscribe',
    oauth2.required,
    verified.required,
    (req, res, next) => {
        const data = req.body;
        data.player_id = req.player.id; // see verified.required
        const tournamentId = data.tournament_id;
        // if subscriptionId player is subscribed. TODO check security!
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
    }
);

// show confirmation page for editing purposes
router.get('/test', (req, res, next) => {
    res.render('profileformconfirm', {
        player: {
            playername: "tester",
            schoolmail: 'test@talnet.nl',
            email: 'test@gmail.com'
        },
        message: ''
    });
});

module.exports = router;
