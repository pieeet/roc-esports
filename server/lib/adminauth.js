'use strict';


function getModel() {
    return require(`../data/model-${require('../../config').get('DATA_BACKEND')}`); // zie voorbeeld Google
}


// [START middleware]
// Middleware that requires the user to be admin. If the user is not admin
// in, it will log out the user.
function adminRequired (req, res, next) {
    getModel().listAdmins(null, null, (err, entities, cursor) => {
        if (err) {
            next(err);
            return;
        }
        let email = req.user.email;
        let isAdmin = false;
        for (let i = 0; i < entities.length; i++) {
            if (email === entities[i].email) {
                isAdmin = true;
            }
        }
        if (!isAdmin) {
            return res.redirect('/auth/logout');
        }
        next();

    });
}

module.exports = {
    required: adminRequired
};