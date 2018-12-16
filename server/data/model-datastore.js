'use strict';

const Datastore = require('@google-cloud/datastore');
const config = require('../../config');

// [START config]
const ds = Datastore({
    projectId: config.get('GCLOUD_PROJECT')
});
// [END config]

const KIND_ADMIN = "Admin";
const KIND_GAME = "Game";

function fromDatastore (obj) {
    obj.id = obj[Datastore.KEY].id;
    return obj;
}

function toDatastore (obj, nonIndexed) {
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

// Creates a new admin or updates an existing admin with new data. The provided
// data is automatically translated into Datastore format. The admin will be
// queued for background processing.
// [START update]
function updateAdmin (id, data, cb) {
    let key;
    if (id) {
        // parse existing id, 10 indicates it's a decimal number (radix)
        key = ds.key([KIND_ADMIN, parseInt(id, 10)]);

    } else {
        // new entity in datastore makes a new id.
        key = ds.key(KIND_ADMIN);
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
// [END update]

function createAdmin (data, cb) {
    updateAdmin(null, data, cb);
}


// Lists all admins in the Datastore sorted alphabetically by name.
// The ``limit`` argument determines the maximum amount of results to
// return per page. The ``token`` argument allows requesting additional
// pages. The callback is invoked with ``(err, books, nextPageToken)``.
// [START list]
function listAdmins (limit, token, cb) {
    const q = ds.createQuery([KIND_ADMIN])
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
// [END list]

// [START delete admin]
function _deleteAdmin (id, cb) {
    const key = ds.key([KIND_ADMIN, parseInt(id, 10)]);
    ds.delete(key, cb);
}
//[END delete admin]

function readAdmin (id, cb) {
    const key = ds.key([KIND_ADMIN, parseInt(id, 10)]);
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

function readGame (id, cb) {
    const key = ds.key([KIND_GAME, parseInt(id, 10)]);
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

function updateGame (id, data, cb) {
    let key;
    if (id) {
        // parse existing id, 10 indicates it's a decimal number (radix)
        key = ds.key([KIND_GAME, parseInt(id, 10)]);

    } else {
        // new entity in datastore makes a new id.
        key = ds.key(KIND_GAME);
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
// [END update]

function createGame (data, cb) {
    updateGame(null, data, cb);
}

function _deleteGame (id, cb) {
    const key = ds.key([KIND_GAME, parseInt(id, 10)]);
    ds.delete(key, cb);
}

function listGames (limit, token, cb) {
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


// [START exports]
module.exports = {
    createAdmin,
    readAdmin,
    updateAdmin,
    deleteAdmin: _deleteAdmin,
    listAdmins,
    createGame,
    readGame,
    updateGame,
    deleteGame: _deleteGame,
    listGames
};
// [END exports]
