'use strict';


function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`);
}


// [START middleware]
// Middleware that requires the user to have a verified schoolmail. If not it will redirect to profile form.
function verifiedRequired(req, res, next) {
    getModel().getPlayer(req.user.email, null, null, (err, entities) => {
        if (err) {
            next(err);
            return;
        }
        let player = entities[0];

        if (!player || player.token !== "verified") {
            return res.redirect('/profile');
        }
        // add player object to request
        req.player = player;
        next();
    });
}


module.exports = {
    required: verifiedRequired
};