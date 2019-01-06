'use strict';

const sendgrid = require('@sendgrid/mail');
const config = require('../../config');
// using SendGrid's v3 Node.js Library
// https://github.com/sendgrid/sendgrid-nodejs
sendgrid.setApiKey(config.get("SENDGRID_API_KEY"));


function makeVerificationToken(size) {
    let token = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < size; i++) {
        token += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return token;
}

function startVerification(schoolmail, token) {
    // 2. make a random token
    let link = `${config.get('BASE_URL')}/api/${schoolmail}/${token}/verifytoken`;
    sendVerificationEmail(schoolmail, link);
}

function sendVerificationEmail(receiver, verificationlink) {
    const msg = {
        to: receiver,
        from: `${config.get("EMAIL_FROM")}`,
        subject: '[ACTION REQUIRED!] - Verify your roc-esports school mail',
        html: `<h2>Thanks for subscribing to roc-esports!</h2>
            <p>Before you can subscribe to our tournaments you have to verify this email address by 
            clicking <a href='${verificationlink}'>this link</a>.</p>
            <p>Happy Gaming!</p>
            <p>The roc-esports team</p>`,
    };
    sendgrid.send(msg);
}
// see https://goo.gl/3kXyj4
function checkValidEmail(email) {
    let regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return regex.test(email);
}

function checkValidSchoolMail(email) {
    // if new schools enter the competition here's the place to add their email domain.
    // Only one domain per school to avoid players making multiple accounts!!!
    const validEmailDomains = [
        // roc flevoland (students and teachers)
        '@talnet.nl'
    ];
    if (checkValidEmail(email)) {
        for (let i = 0; i < validEmailDomains.length; i++) {
            if (email.endsWith(validEmailDomains[i])) {
                return true;
            }
        }
    }
    return false;
}

function sendWelcomeEmail(email) {
    const msg = {
        to: email,
        from: `${config.get("EMAIL_FROM")}`,
        subject: 'Welcome to roc-esports: please whitelist us',
        html: `<h2>Welcome to ROC-Esports!</h2>
            <p>To receive future notifications about our tournaments on this e-mail address, please whitelist this email if 
            it was sent to your spam folder.</p>
            <p>Happy Gaming!</p>
            <p>The roc-esports team</p>`,
    };
    sendgrid.send(msg);
}


module.exports = {
    startVerification,
    checkValidSchoolMail,
    sendWelcomeEmail
};