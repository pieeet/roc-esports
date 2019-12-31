const express = require('express');
const router = express.Router();
const oauth2 = require('../lib/oauth2');

// Use the oauth2 middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);

// Use the 'verified' middleware to automatically get the player's profile if verified is required
const verified = require('../lib/verified');

// simple worker functions
const utils = require('../lib/utils');
const emailutils = require('../lib/emailutils');

//middleware to parse form-data with binary file and upload to GCS
const images = require('../lib/images');

// moment module to handle dates
const moment = require('moment-timezone');

// Table names in database
const KIND_GAME = "Game";
const KIND_TOURNAMENT = "Tournament";
const KIND_PLAYER = "Player";
const KIND_PLAYER_TOURNAMENT = "Player_Tournament";
const KIND_TEAM = "Team";
const KIND_TEAM_PLAYER = "Team_Player";

// Min Max size player name
const MIN_NAME = 5;
const MAX_NAME = 13;

// module to parse form data
const bodyParser = require('body-parser');
router.use(bodyParser.urlencoded({extended: false}));


// Set Content-Type for all responses for these routes
router.use((req, res, next) => {
    res.set('Content-Type', 'text/html');
    next();
});

// get database middleware
function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`);
}

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'roc-dev esports'});
});

/* GET subscribe page*/
router.get('/tournaments', (req, res, next) => {
    getModel().listTournaments(null, null, 0, (err, tournaments, cursor) => {
        if (err) {
            next(err);
            return;
        }
        if (!tournaments.length) {
            res.render('subscribelist.pug', {
                tournaments: tournaments
            });
        } else {
            let tournamentslist = [];
            for (let i = 0; i < tournaments.length; i++) {
                let tournament = tournaments[i];
                tournament.date = utils.prettyDate(new Date(tournament.starttime));
                tournament.starttime = utils.prettyTime(new Date(tournament.starttime));
                tournament.endtime = utils.prettyTime(new Date(tournament.endtime));

                // replace tournament.game (id) with full game entity so we have game data
                getModel().read(KIND_GAME, tournament.game, (err, game) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    tournament.game = game;
                    tournamentslist.push(tournament);

                    //



                    // datastore sort function not always working (due to async?)
                    if (tournamentslist.length === tournaments.length) {
                        tournamentslist.sort(function (a, b) {
                            return (a.starttime > b.starttime) ? -1 :
                                ((b.starttime > a.starttime) ? 1 : 0);
                        });
                        res.render('subscribelist.pug', {
                            tournaments: tournamentslist
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
        });
    });
});

router.post('/createplayer',
    oauth2.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        let data = req.body;
        data = utils.sanitizeProfileFormData(data);
        if (data.playername.length < MIN_NAME || data.playername.length > MAX_NAME) {
            res.render(`profileformconfirm`, {
                player: data,
                message: 'Player name too short or too long. '
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
        if (req.file && req.file.cloudStoragePublicUrl) {
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
            data.imageUrl = req.body.imageUrl;
        }
        // only store imageUrl, file is stored in GCS no need to save in db
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
                // check if the playername isn't already in use
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
        data = utils.sanitizeProfileFormData(data);
        // Was an image uploaded? If so, we'll use its public URL
        // in cloud storage. Old file is deleted from storage.
        let imgChanged = false;
        if (req.file && req.file.cloudStoragePublicUrl) {
            if (data.imageUrl) {
                const oldImageUrl = data.imageUrl.valueOf();
                images.deleteImage(oldImageUrl);
            }
            req.body.imageUrl = req.file.cloudStoragePublicUrl;
            imgChanged = true;
        }
        const id = data.playerid.valueOf();
        delete data.playerid;
        // get player from database to change its relevant properties
        getModel().read(KIND_PLAYER, id, (err, player) => {
            if (err) {
                next(err);
                return;
            }
            player.school = data.school;
            player.opleiding = data.opleiding;
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
                } else {
                    emailutils.startVerification(player.schoolmail, player.token);
                    return res.render(`profileformconfirm`, {
                        player: player,
                        message: ''
                    });
                }
            } // [END UPDATE SCHOOLMAIL]
            // schoolmail is not in form-data meaning player is already verified
            else {
                // player changed name check validity and availability
                if (data.playername !== player.playername) {
                    // [START NAME CHANGE]
                    //name has changed verify validity
                    if (data.playername.length < MIN_NAME || data.playername.length > MAX_NAME) {
                        return res.render(`profileformconfirm`, {
                            player: data,
                            message: 'Provided name is too short or too long.'
                        });
                    } else {
                        // verify availability
                        getModel().playernameAvailable(data.playername, (err, available) => {
                            if (available) {
                                //change playername
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
                else {
                    getModel().update(KIND_PLAYER, id, player, (err, cb) => {
                        if (err) {
                            next(err);
                            return;
                        }
                        return res.redirect('/profile');
                    });
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
            let endreg = new Date(tournament.endreg);

            tournament.date = utils.prettyDate(start);
            tournament.starttime = utils.prettyTime(start);
            tournament.endtime = utils.prettyTime(end);
            tournament.endreg = utils.prettyDate(endreg);

            // is registration still open?
            const inTime = Date.now() < endreg;

            //get the game associated with the tournament
            getModel().read(KIND_GAME, tournament.game, (err, ent) => {
                if (err) {
                    next(err);
                    return;
                }
                // replace game id with game
                tournament.game = ent;
                // get player from request. This is guaranteed because verified.required
                let player = req.player;
                // check if tournament is team play
                let isTeamgame = tournament.game.teamsize > 1;
                let units = 'players';
                if (isTeamgame) units = 'teams';
                console.log(units);
                // make a list of subscribers
                getModel().getAttendees(tournament.id, isTeamgame, (err, attendees) => {
                    // sort on subscription timestamp
                    attendees.sort(function (a, b) {
                        return (a.timestamp > b.timestamp) ? 1 :
                            ((b.timestamp > a.timestamp) ? -1 : 0);
                    });
                    let actionTournament;

                    // teamgame
                    if (isTeamgame) {
                        getModel().getTeamFromPlayerForGame(player.id, tournament.game.id, (err, team) => {
                            // user is teamleader
                            if (team && player.id === team.leader) {
                                getModel().getSubscription(tournament.id, team.id, (err, ent) => {
                                    if (ent === null || !ent.length) {
                                        actionTournament = "Subscribe";
                                    } else {
                                        actionTournament = "Unsubscribe";
                                    }
                                    return res.render('subscribeform', {
                                        units: units,
                                        team: team,
                                        tournament: tournament,
                                        actiontournament: actionTournament,
                                        attendees: attendees,
                                        intime: inTime
                                    });
                                });
                                // has no team or is not teamleader
                            } else {
                                actionTournament = 'Subscriptions';
                                return res.render('subscribeform', {
                                    units: units,
                                    tournament: tournament,
                                    actiontournament: actionTournament,
                                    attendees: attendees,
                                    intime: inTime
                                });
                            }
                        });
                    }
                    // individual game
                    else {
                        getModel().getSubscription(tournament.id, player.id, (err, ent) => {
                            if (err) {
                                next(err);
                                return;
                            }
                            if (ent === null || !ent.length) {
                                actionTournament = "Subscribe";
                            } else {
                                actionTournament = "Unsubscribe";
                            }
                            return res.render('subscribeform', {
                                units: units,
                                tournament: tournament,
                                actiontournament: actionTournament,
                                attendees: attendees,
                                intime: inTime
                            });
                        });
                    }
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
         // see verified.required
        data.player_id = req.player.id;
        // if team game replace player_id with team_id
        if (data.team_id) data.player_id = data.team_id.valueOf();
        delete data.team_id;
        const tournamentId = req.params.tournament;
        data.tournament_id = tournamentId;
        getModel().getSubscription(tournamentId, data.player_id, (err, ent) => {
            if (err) {
                next(err);
                return;
            }
            if (ent === null || !ent.length) {
                let now = moment.tz(new Date(), 'Europe/Amsterdam');
                data.timestamp = now.utc().valueOf();
                getModel().create(KIND_PLAYER_TOURNAMENT, data, (err, cb) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    res.redirect(`/${tournamentId}/subscribe`);
                });
            } else {
                getModel().delete(KIND_PLAYER_TOURNAMENT, ent[0].id, (err, cb) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    res.redirect(`/${tournamentId}/subscribe`);
                });
            }
        });
    }
);

router.get('/teamgames', oauth2.required, verified.required, (req, res, next) => {
    getModel().listGames(null, null, (err, gameEntities, cursor) => {
        if (err) {
            next(err);
            return;
        }
        let teamgames = [];
        for (let i = 0; i < gameEntities.length; i++) {
            if (gameEntities[i].teamsize > 1) {
                teamgames.push(gameEntities[i]);
            }
        }
        res.render('teamgames', {
            games: teamgames
        });
    });
});

router.get('/createteam', (req, res, next) => {
    res.redirect(`/${req.query.game}/createteam`);
});

router.get('/:game/createteam', oauth2.required, verified.required, (req, res, next) => {
    const player = req.player;
    const gameId = req.params.game;
    getModel().read(KIND_GAME, gameId, (err, game) => {
        getModel().getTeamFromPlayerForGame(player.id, game.id, (err, team) => {
            // player has a team
            if (team) {
                const teamleaderId = team.leader.valueOf();
                getModel().read(KIND_PLAYER, teamleaderId, (err, leader) => {
                    // replace id teamleader with player so we can expose its name
                    team.leader = leader;
                    // check if player is teamleader
                    let isLeader = leader.id === player.id;
                    getModel().listTeamMembers(team.id, (err, teamMembers) => {
                        res.render('createteamform', {
                            members: teamMembers,
                            team: team,
                            game: game,
                            player: player,
                            isleader: isLeader
                        });
                    });
                })
            } else {
                res.render('createteamform', {
                    game: game,
                    player: player
                });
            }
        });
    });
});

router.post('/:game/createteam',
    oauth2.required,
    verified.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;
        const player = req.player;

        // get the game
        getModel().read(KIND_GAME, req.params.game, (err, game) => {
            if (err) {
                next(err);
                return
            }

            //sanitize teamname
            data.name = data.name.trim();
            if (data.name.length > MAX_NAME)
                data.name = data.name.substring(0, MAX_NAME) + '...';
            // check if team name = available
            getModel().teamNameAvailableForGame(data.name, req.params.game, (err, isAvailable) => {
                if (isAvailable) {
                    const teamSize = game.teamsize;
                    console.log(teamSize);
                    // check members
                    let members = [];
                    for (let i = 0; i < teamSize; i++) {
                        const schoolmail = data['member_' + i];
                        getPlayerForTeam(schoolmail, game, (err, teamplayer, errMsg) => {
                            if (!teamplayer) {
                                return res.render('createteamform', {
                                    message: errMsg,
                                    game: game,
                                    player: player
                                });
                            } else {
                                let member = {};
                                member.player_id = teamplayer.id;
                                members.push(member);

                                // number of members equals teamsize: we have a go! Create team and team_players
                                if (members.length === teamSize) {
                                    console.log("members completed");
                                    let teamData = {};
                                    //team must have same name/opleiding/img attrs as player so it's same
                                    // on attendees list page
                                    teamData.playername = data.name;
                                    // for a team opleiding === school.
                                    teamData.opleiding = data.school;
                                    teamData.school = data.school;
                                    if (req.file && req.file.cloudStoragePublicUrl) {
                                        teamData.imageUrl = req.file.cloudStoragePublicUrl;
                                    }
                                    // player that creates team is the teamleader
                                    teamData.leader = player.id;
                                    teamData.game_id = req.params.game;
                                    // save team
                                    getModel().create(KIND_TEAM, teamData, (err, team) => {
                                        if (err) {
                                            next(err);
                                            return;
                                        }
                                        // save team members
                                        for (let i = 0; i < members.length; i++) {
                                            let tp = members[i];
                                            tp.team_id = team.id;
                                            getModel().create(KIND_TEAM_PLAYER, tp, (err, cb) => {
                                                if (err) {
                                                    next(err);
                                                    return;
                                                }
                                                // all members are saved
                                                if (i === members.length - 1) {
                                                    return res.redirect('/teamgames');
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        });
                    }
                } else {
                    res.render('createteamform', {
                        message: `The team name ${data.name} is already in use. 
                                                    Please choose another name`,
                        game: game,
                        player: player
                    });
                }
            });
        });
    }
);

router.post('/:team/updateteam',
    oauth2.required,
    verified.required,
    images.multer.single('image'),
    images.sendUploadToGCS,
    (req, res, next) => {
        const data = req.body;
        const teamId = req.params.team;
        let imageChanged = false;
        getModel().read(KIND_TEAM, teamId, (err, team) => {
            getModel().read(KIND_PLAYER, team.leader, (err, leader) => {
                if (req.file && req.file.cloudStoragePublicUrl) {
                    team.imageUrl = req.file.cloudStoragePublicUrl;
                    imageChanged = true;
                }
                // user changed team name
                if (data.name !== team.playername) {
                    if (data.name.length > MAX_NAME)
                        data.name = data.name.substring(0, MAX_NAME - 1) + '...';
                    // check if teamname is available
                    getModel().teamNameAvailableForGame(data.name, team.game_id, (err, isAvailable) => {
                        if (isAvailable) {
                            team.playername = data.name;
                            delete team.id;
                            if (imageChanged) images.deleteImage(data.team_logo);
                            getModel().update(KIND_TEAM, teamId, team, (err, cb) => {
                                return res.redirect('/teamgames');
                            });
                        } else {
                            getModel().read(KIND_GAME, team.game_id, (err, game) => {
                                // change leader-id with leader object
                                team.leader = leader;
                                res.render('createteamform', {
                                    message: `The team name ${data.name} is already in use. 
                                                    Please choose another name`,
                                    game: game,
                                    team: team,
                                    player: player
                                });
                            });
                        }
                    });
                } else {
                    if (imageChanged) images.deleteImage(data.team_logo);
                    getModel().update(KIND_TEAM, teamId, team, (err, cb) => {
                        return res.redirect('/teamgames');
                    });
                }
            });
        });
    }
);

router.post('/:teamplayerid/replaceteammember',
    oauth2.required,
    verified.required, (req, res, next) => {
        const data = req.body;
        const schoolmail = data.schoolmail;
        const gameId = data.game_id;
        const teamId = data.team_id;
        // only a teamleader can access this route
        const leader = req.player;
        getModel().read(KIND_GAME, gameId, (err, game) => {
            // get team from leader to pass in case of error
            getPlayerForTeam(schoolmail, game, (err, teamMember, errMsg) => {
                // team member not valid. Render createteamform with appropriate error message
                if (!teamMember) {
                    //to render page we need a team...
                    getModel().getTeamFromPlayerForGame(leader.id, gameId, (err, team) => {
                        //... and team members...
                        getModel().listTeamMembers(teamId, (err, members) => {
                            //... and a team leader
                            team.leader = leader;
                            return res.render('createteamform', {
                                message: errMsg,
                                game: game,
                                isleader: true,
                                player: req.player,
                                team: team,
                                members: members
                            });
                        });
                    });
                    //update teamplayer and redirect to teamgames
                } else {
                    const teamplayerId = req.params.teamplayerid;
                    getModel().read(KIND_TEAM_PLAYER, teamplayerId, (err, teamplayer) => {
                        teamplayer.player_id = teamMember.id;
                        getModel().update(KIND_TEAM_PLAYER, teamplayerId, teamplayer, (err, cb) => {
                            return res.redirect('/teamgames');
                        });
                    });
                }
            });
        });
    }
);

function getPlayerForTeam(schoolmail, game, callback) {
    //check if player exists
    getModel().getPlayerFromSchoolmail(schoolmail, null, null, (err, players) => {
        const player = players[0];
        if (!player) {
            callback(null, null, `Player with schoolmail ${schoolmail} not found. Only registered players can be 
                                added to a team.`);
        } else if (player.token !== 'verified') {
            callback(null, null, `Player with schoolmail ${schoolmail} not yet verified. Only verified 
                                    players can be added to a team.`)
        } else {
            getModel().getTeamFromPlayerForGame(player.id, game.id, (err, team) => {
                if (team !== null) {
                    callback(null, null, `Player with schoolmail ${schoolmail} already is in a team for ${game.name}. 
                                            Players can only be in one team per game.`)
                } else {
                    callback(null, player, null);
                }
            });
        }
    });
}

router.get('/verifiedconfirm', (req, res, next) => {
    return res.render('verifiedconfirm');
});

module.exports = router;
