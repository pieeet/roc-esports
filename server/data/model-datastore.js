'use strict';

const Datastore = require('@google-cloud/datastore');
const config = require('../../config');

// [START config]
const ds = Datastore({
    projectId: config.get('GCLOUD_PROJECT')
});

const KIND_GAME = "Game";
const KIND_TOURNAMENT = "Tournament";
const KIND_PLAYER = "Player";
const KIND_PLAYER_TOURNAMENT = "Player_Tournament";

// [END config]

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

function listTournaments(limit, token, startDate, cb) {
    const q = ds.createQuery([KIND_TOURNAMENT])
        .limit(limit)
        // .filter('starttime', '>', startDate)
        .order('starttime', {
            descending: true,
        })
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


function getAttendees(tournamentId, cb) {
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
            let nEntities = ents.length;
            for (let i = 0; i < ents.length; i++) {
                read(KIND_PLAYER, ents[i].player_id, (err, player) => {
                    if (err) {
                        //if player cannot be found
                        nEntities--;
                    }
                    if (player) {
                        player.timestamp = ents[i].timestamp;
                        attendees.push(player);
                        if (attendees.length === nEntities) {
                            //sort array based on playername
                            attendees.sort(function(a,b) {return (a.timestamp > b.timestamp) ? 1 :
                                ((b.timestamp > a.timestamp) ? -1 : 0);} );
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

    getPlayer,
    getSubscription,
    getAttendees,
    verifyEmail,
    isAdmin,
    schoolmailAvailable,
    playernameAvailable
};
// [END exports]
