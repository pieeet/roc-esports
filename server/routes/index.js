var express = require('express');
var router = express.Router();
const oauth2 = require('../lib/oauth2');
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

/* GET home page. */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'roc-dev esports'});
});

/* GET subscribe page*/
router.get('/tournaments',
    (reg, res, next) => {
        let tournaments = {};
        getModel().listTournaments(null, null, (err, tournamentEntities, cursor) => {
            if (err) {
                next(err);
                return;
            }
            tournaments = tournamentEntities;
            for (let i = 0; i < tournaments.length; i++) {
                // replace tournament.game (id only) with full game entity so we have game data
                let gameId = tournaments[i].game;

                getModel().read(KIND_GAME, gameId, (err, entity) => {
                    if (err) {
                        next(err);
                        return;
                    }
                    tournaments[i].gamename = entity.name;
                    tournaments[i].gameImg = entity.imageUrl;
                    console.log(tournaments[i].gamename);
                    console.log(tournaments[i].imgUrl);
                    if (i === tournaments.length - 1) {
                        res.render('subscribelist.pug', {
                            tournaments: tournaments
                        });
                    }
                });
            }


        });


    });
module.exports = router;
