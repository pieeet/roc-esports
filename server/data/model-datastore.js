'use strict';

const Datastore = require('@google-cloud/datastore');

// [START config]
const ds = Datastore();

const KIND_GAME = "Game";
const KIND_TOURNAMENT = "Tournament";
const KIND_PLAYER = "Player";
const KIND_PLAYER_TOURNAMENT = "Player_Tournament";
const KIND_TEAM = "Team";
const KIND_TEAM_PLAYER = "Team_Player";
const KIND_SCHOOL = "School";

// [END config]

// add id property to object from key
function fromDatastore(obj) {
    obj.id = obj[Datastore.KEY].id;
    return obj;
}

function toDatastore(obj, nonIndexed) {
    nonIndexed = nonIndexed || [];
    const results = [];
    Object.keys(obj).forEach((k) => {
        if (obj[k] === undefined) {
            return;
        }
        results.push({
            name: k,
            value: obj[k],
            excludeFromIndexes: nonIndexed.indexOf(k) !== -1
        });
    });
    return results;
}

function update(table, id, data, cb) {
    let key;
    if (id) {
        // parse existing id, 10 indicates it's a decimal number (radix)
        key = ds.key([table, parseInt(id, 10)]);

    } else {
        // new entity in datastore makes a new id.
        key = ds.key(table);
    }

    const entity = {
        key: key,
        // array with non-indexed fields
        data: toDatastore(data, [])
    };

    ds.save(
        entity,
        (err) => {
            data.id = entity.key.id;
            cb(err, err ? null : data);
        }
    );
}

function create(table, data, cb) {
    update(table, null, data, cb);
}

function _delete(table, id, cb) {
    const key = ds.key([table, parseInt(id, 10)]);
    ds.delete(key, cb);
}

// Lists all admins in the Datastore sorted alphabetically by name.
// The ``limit`` argument determines the maximum amount of results to
// return per page. The ``token`` argument allows requesting additional
// pages. The callback is invoked with ``(err, books, nextPageToken)``.
// [START list]
function listAdmins(limit, token, minrole, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .limit(limit)
        .filter('role', '>=', minrole)
        .order('role', {
            descending: true
        })
        .order('playername')
        .start(token);

    ds.runQuery(q, (err, entities, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        const hasMore = nextQuery.moreResults !== Datastore.NO_MORE_RESULTS ? nextQuery.endCursor : false;
        cb(null, entities.map(fromDatastore), hasMore);
    });
}

function read(table, id, cb) {
    const key = ds.key([table, parseInt(id, 10)]);
    ds.get(key, (err, entity) => {
        if (!err && !entity) {
            err = {
                code: 404,
                message: 'Not found'
            };
        }
        if (err) {
            cb(err);
            return;
        }
        cb(null, fromDatastore(entity));
    });
}

function listGames(limit, token, cb) {
    const q = ds.createQuery([KIND_GAME])
        .limit(limit)
        .order('name')
        .start(token);

    ds.runQuery(q, (err, entities, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        const hasMore = nextQuery.moreResults !== Datastore.NO_MORE_RESULTS ? nextQuery.endCursor : false;
        cb(null, entities.map(fromDatastore), hasMore);
    });
}

function getPlayer(email, limit, token, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .limit(limit)
        .filter('email', '=', email)
        .start(token);
    ds.runQuery(q, (err, player, nextQuery) => {
        if (!err && !player) {
            err = {
                code: 404,
                message: 'Not found'
            };
        }
        if (err) {
            cb(err);
            return;
        }
        cb(null, player.map(fromDatastore), false);
    });
}

function getPlayerFromSchoolmail(email, limit, token, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .limit(limit)
        .filter('schoolmail', '=', email)
        .start(token);
    ds.runQuery(q, (err, player, nextQuery) => {
        if (!err && !player) {
            err = {
                code: 404,
                message: 'Not found'
            };
        }
        if (err) {
            cb(err);
            return;
        }
        cb(null, player.map(fromDatastore), false);
    });
}

// get tournaments with startdate. To list all tournaments you can use 0 as startDate
function listTournaments(limit, token, startDate, cb) {
    const q = ds.createQuery([KIND_TOURNAMENT])
        .limit(limit)
        .filter('starttime', '>', startDate)
        .start(token);

    ds.runQuery(q, (err, entities, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        const hasMore = nextQuery.moreResults !== Datastore.NO_MORE_RESULTS ? nextQuery.endCursor : false;
        cb(null, entities.map(fromDatastore), hasMore);
    });
}

function listSchools(limit, token, cb) {
    const q = ds.createQuery([KIND_SCHOOL]).limit(limit).start(token);
    ds.runQuery(q, (err, schools, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        const hasMore = nextQuery.moreResults !== Datastore.NO_MORE_RESULTS ? nextQuery.endCursor : false;
        cb(null, schools.map(fromDatastore, hasMore))
    });
}

// returns admin or null
function isAdmin(email, minrole, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .limit(1)
        .filter('email', '=', email)
        .select(['role']);

    ds.runQuery(q, (err, players, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        let admin = null;
        if (players[0].role >= minrole) {
            admin = players[0];
        }
        cb(null, admin);
    });
}

function listPlayers(limit, token, minrole, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .limit(limit)
        .filter('role', '>=', minrole)
        .order('role')
        .order('playername')
        .start(token);
    ds.runQuery(q, (err, players, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        const hasMore = nextQuery.moreResults !== Datastore.NO_MORE_RESULTS ? nextQuery.endCursor : false;
        cb(null, players.map(fromDatastore), hasMore);
    })
}

function getSubscription(tournament, player, cb) {
    const q = ds.createQuery([KIND_PLAYER_TOURNAMENT])
        .filter('player_id', '=', player)
        .filter('tournament_id', '=', tournament);
    ds.runQuery(q, (err, entity, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        cb(null, entity.map(fromDatastore));
    });
}

function getAttendees(tournamentId, isTeamGame, cb) {
    let attendees = [];
    const q = ds.createQuery([KIND_PLAYER_TOURNAMENT])
        .filter('tournament_id', '=', tournamentId);

    ds.runQuery(q, (err, ents, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        // no attendees return empty list
        if (!ents.length) {
            cb(null, attendees);
        } else {
            // resolve during testing accidentally deleted player
            let nEntities = ents.length;
            // attendee can be player or team
            let table = KIND_PLAYER;
            if (isTeamGame) table = KIND_TEAM;
            for (let i = 0; i < ents.length; i++) {
                const subscription = fromDatastore(ents[i]);
                read(table, subscription.player_id, (err, attendee) => {
                    if (err) {
                        //if player cannot be found
                        nEntities--;
                    }
                    if (attendee) {
                        // check if player is already checked in for tournament
                        if (subscription.checkedin) {
                            attendee.checkedin = subscription.checkedin;
                        } else {
                            attendee.checkedin = false;
                        }
                        attendee.subscriptionid = subscription.id;
                        attendee.timestamp = subscription.timestamp;
                        attendees.push(attendee);
                        if (attendees.length === nEntities) {
                            cb(null, attendees);
                        }
                    }
                });
            }
        }
    });
}

function verifyEmail(email, token, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .filter('schoolmail', '=', email)
        .limit(1);
    ds.runQuery(q, (err, players, nextQuery) => {
        if (err) {
            cb(err);
            return;
        }
        let player = fromDatastore(players[0]);

        const id = player.id.valueOf();
        delete player.id;
        // avoid server error if users clicks email again after being verified
        if (player.token === token || player.token === "verified")
            player['token'] = "verified";
        update(KIND_PLAYER, id, player, (err, res) => {
            if (err) {
                cb(err);
            }
            cb(null, 200);
        });
    });
}

function schoolmailAvailable(schoolmail, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .filter('schoolmail', '=', schoolmail);
    ds.runQuery(q, (err, ent) => {
        if (err) {
            cb(err);
            return;
        }
        if (ent.length > 0) {
            cb(null, false);
        } else {
            cb(null, true);
        }
    });
}

function playernameAvailable(playername, cb) {
    const q = ds.createQuery([KIND_PLAYER])
        .filter('playername', '=', playername);
    ds.runQuery(q, (err, ent) => {
        if (err) {
            cb(err);
            return;
        }
        if (ent.length > 0) {
            cb(null, false);
        } else {
            cb(null, true);
        }
    });
}

function teamNameAvailableForGame(teamname, gameId, cb) {
    const q = ds.createQuery([KIND_TEAM])
        .filter('game_id', '=', gameId);
    ds.runQuery(q, (err, teams) => {
        if (teams.length === 0) return cb(null, true);
        for (let i = 0; i < teams.length; i++) {
            if (teams[i].playername.toLowerCase() === teamname.toLowerCase()) {
                return cb(null, false);
            }
            if (i === teams.length - 1) {
                return cb(null, true);
            }
        }
    });
}

function getTeamFromPlayerForGame(playerid, gameId, cb) {
    const q = ds.createQuery([KIND_TEAM_PLAYER]).filter('player_id', '=', playerid);
    ds.runQuery(q, (err, ents) => {
        if (ents.length === 0) {
            return cb(null, null);
        } else {
            let count = 0;
            for (let i = 0; i < ents.length; i++) {
                const ent = ents[i];
                const teamId = ent.team_id;
                read(KIND_TEAM, teamId, (err, team) => {
                    if (team.game_id === gameId) {
                        return cb(null, team);
                    } else {
                        count++;
                    }
                    if (count === ents.length) {
                        return cb(null, null);
                    }
                });
            }
        }
    });
}

function listTeamMembers(teamid, cb) {
    const q = ds.createQuery(KIND_TEAM_PLAYER).filter('team_id', '=', teamid);
    ds.runQuery(q, (err, ents) => {
        let teamMembers = [];
        for (let i = 0; i < ents.length; i++) {
            const tp = fromDatastore(ents[i]);
            const playerId = tp.player_id;
            read(KIND_PLAYER, playerId, (err, player) => {
                player.tpId = tp.id;
                teamMembers.push(player);
                if (teamMembers.length === ents.length) {
                    cb(null, teamMembers);
                }
            });

        }
    });
}

function deleteTeam(teamId, cb) {

    const q = ds.createQuery(KIND_TEAM_PLAYER).filter('team_id', '=', teamId);
    ds.runQuery(q, (err, ents) => {
        for (let i = 0; i < ents.length; i++) {
            ents[i] = fromDatastore(ents[i]);
        }
        // set property deleted in team so we don't lose the games they've played
        read(KIND_TEAM, teamId, (err, team) => {
            const id = team.id.valueOf();
            delete team.id;
            team.deleted = true;
            update(KIND_TEAM, id, team, (err, res) => {
                if (err) {
                    cb(err);
                }
                cb(null, ents);
            });
        });
    });

}


// [START exports]
module.exports = {
    create,
    read,
    update,
    delete: _delete,

    listAdmins,
    listPlayers,
    listGames,
    listTournaments,
    listTeamMembers,

    getPlayer,
    getPlayerFromSchoolmail,
    getSubscription,
    getAttendees,
    verifyEmail,
    isAdmin,
    schoolmailAvailable,
    playernameAvailable,
    getTeamFromPlayerForGame,
    teamNameAvailableForGame,
    listSchools,
    deleteTeam

};
// [END exports]
