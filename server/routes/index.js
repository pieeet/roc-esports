var express = require('express');
var router = express.Router();
const oauth2 = require('../lib/oauth2');
// Use the oauth middleware to automatically get the user's profile
// information and expose login/logout URLs to templates.
router.use(oauth2.template);


function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
    // return require('../data/model-datastore'); // doet hetzelfde
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'roc-dev esports' });
});

/* GET subscribe pagen*/
router.get('/subscribe', oauth2.required,
    (reg, res, next) => {
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
            res.render('subscribe.pug', {
                tournaments: tournaments
            });
        });
    });
});
module.exports = router;
