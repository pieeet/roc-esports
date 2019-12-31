// App.JS

'use strict';

const createError = require('http-errors');
const yesHttps = require('yes-https');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./server/routes/index');
const adminRouter = require('./server/routes/admin');
const apiRouter = require('./server/routes/api');
const app = express();
const config = require('./config');

// view engine setup
app.set('views', path.join('client/views'));
app.set('view engine', 'pug');
app.set('trust proxy', true);

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(yesHttps());
//log requests in dev mode
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join('client/public')));

// [START session]
// Configure the session and session storage.
const sessionConfig = {
    resave: false,
    saveUninitialized: false,
    secret: config.get('SECRET'),
    signed: true
};

app.use(session(sessionConfig));
// [END session]

// OAuth2
app.use(passport.initialize());
app.use(passport.session());
app.use(require('./server/lib/oauth2').router);

//routers
app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/api', apiRouter);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    // res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

if (module === require.main) {

    // Create HTTP server on config port / 3000
    const server = app.listen(config.get('PORT') || '3000', () => {
        const port = server.address().port;
        console.log(`App test listening on port ${port}`);
    });
}


module.exports = app;

