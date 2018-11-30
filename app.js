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

const indexRouter = require('./routes/index');
const adminRouter = require('./routes/admin');
const apiRouter = require('./routes/api');
const app = express();
const config = require('./config');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('trust proxy', true);

app.use(yesHttps());
//log requests in dev mode
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// [START session]
// Configure the session and session storage.
const sessionConfig = {
    resave: false,
    saveUninitialized: false,
    secret: config.get('SECRET'),
    signed: true
};
// from google tutorial NOT WORKING
// In production use the Memcache instance to store session data,
// otherwise fallback to the default MemoryStore in development.
// if (config.get('NODE_ENV') === 'production' && config.get('MEMCACHE_URL')) {
//   if (config.get('MEMCACHE_USERNAME') && (config.get('MEMCACHE_PASSWORD'))) {
//     sessionConfig.store = new MemcachedStore({
//       servers: [config.get('MEMCACHE_URL')],
//       username: config.get('MEMCACHE_USERNAME'),
//       password: config.get('MEMCACHE_PASSWORD')});
//   } else {
//     sessionConfig.store = new MemcachedStore({
//       servers: [config.get('MEMCACHE_URL')]
//     });
//   }
// }

app.use(session(sessionConfig));
// [END session]

// OAuth2
app.use(passport.initialize());
app.use(passport.session());
app.use(require('./lib/oauth2').router);

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
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

if (module === require.main) {
    // Start the server
    const server = app.listen(config.get('PORT'), () => {
        const port = server.address().port;
        console.log(`App test listening on port ${port}`);
    });
}


module.exports = app;

