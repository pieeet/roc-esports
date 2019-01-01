'use strict';

const moment = require('moment-timezone');
const sendgrid = require('@sendgrid/mail');
const config = require('../../config');
// using SendGrid's v3 Node.js Library
// https://github.com/sendgrid/sendgrid-nodejs
sendgrid.setApiKey(config.get("SENDGRID_API_KEY"));


function prettyTime(date) {
    let mmnt = moment.tz(date.getTime(), 'Europe/Amsterdam');
    let out = '';
    if (mmnt.hours() < 10) {
        out = '0' + mmnt.hours() + ':';
    } else
        out = mmnt.hours() + ':';
    if ((mmnt.minutes() < 10)) {
        out += '0' + mmnt.minutes();
    } else
        out += mmnt.minutes();
    return out;
}

function prettyDate(date) {
    let out = date.getFullYear() + '-';
    // month = zero based (jan == 0)
    if (date.getMonth() + 1 < 10) {
        out += '0' + (date.getMonth() + 1) + '-';
    } else
        out += date.getMonth() + 1 + '-';
    if ((date.getDate() < 10)) {
        out += '0' + date.getDate();
    } else
        out += date.getDate();
    return out;
}

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
    sendEmail(schoolmail, link);
}

function sendEmail(receiver, verificationlink) {
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


module.exports = {
    prettyTime,
    prettyDate,
    makeVerificationToken,
    startVerification,
    checkValidSchoolMail
};