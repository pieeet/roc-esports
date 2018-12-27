'use strict';

const moment = require('moment-timezone');

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

module.exports = {
    prettyTime,
    prettyDate
};