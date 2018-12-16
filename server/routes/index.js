var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'roc-dev esports' });
});

/* GET subscribe pagen*/
router.get('/subscribe', (reg, res, next) => {
  res.render('subscribe', {title: 'roc-esports'});
});
module.exports = router;
