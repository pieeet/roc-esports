'use strict';


function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
}


// [START middleware]
// Middleware that requires the user to be admin. If the user is not admin
// he will be redirected to a non-admin area.
function adminRequired (req, res, next) {
    // 1 is the lowest admin level.
    getModel().isAdmin(req.user.email, 1, (err, admin) => {
        if (err) {
            next(err);
            return;
        }
        if (admin === null) {
            return res.redirect('/tournaments');
        } else {
            req.admin = admin;
        }
        next();
    });
}

module.exports = {
    required: adminRequired
};