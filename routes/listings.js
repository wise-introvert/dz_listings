var express = require('express');
var router = express.Router();
var db = require('../helper').db
var give = require('../helper').give
var _ = require('underscore');

// { "id": 0, "d": 0, "title": 3, "desc": "dqs878dsq" }
/* GET listings not including deactivated. */
router.get('/', function (req, res, next) {
  var pubListings = db.toPublic(100)
  res.render('listings', { title: 'Express', listings: pubListings });
});


/* GET one listing; must be deactivated. */
router.get('/:id', function (req, res, next) {
  var id = parseInt(req.params.id)
  var elem = db.get({ id: id, d: 0 })
  if (_.isEmpty(elem))
    res.render('listing', { title: 'Express', data: elem, error: "No listing found :(" });
  else
    res.render('listing', { title: 'Express', data: elem, success: "Yep :)" });
});

// https://regex101.com/r/1Q2EcU/1
// Working, téomorrow with Jude.
/* Query listings not including deactivated. */
router.post('/query', async (req, res, next) => {
  const { body } = req;
  var activeListings = db.toPublic()
  const querySchema = Joi.object().keys({
    title: Joi.string().regex(/^\W*\w+(?:\W+\w+)*\W*$/).min(3).max(100),
    exactTitle: Joi.boolean().truthy('on').falsy('off').default(false),
    desc: Joi.string().min(10).max(500),
    exactDesc: Joi.boolean().truthy('on').falsy('off').default(false),
    since: Joi.date().iso()
  }).or('title', 'desc');

  const result = querySchema.validate(body);
  const { value, error } = result;
  const valid = error == null;
  if (!valid) {
    res.status(422).json({
      message: 'Invalid request',
      data: body,
      error: error
    })
  } else {
    if (body.exactTitle)
      activeListings = db.fetch({ title: body.title }, activeListings)
    else
      activeListings = db.fetchDeep('title', body.title, activeListings)
    if (body.exactDesc)
      activeListings = db.fetch({ desc: body.desc }, activeListings)
    else
      activeListings = db.fetchDeep('desc', body.desc, activeListings)
  }
  var then = Math.floor(new Date(body.since).getTime() / 1000)
  activeListings = db.since(then, activeListings)
  res.render('listings', { title: 'Express', listings: db.toPublic(100, activeListings) });
});

/* Query listings not including deactivated. */
router.post('/queryV2', async (req, res, next) => {
  const { body } = req;
  const querySchema = Joi.object().keys({
    title_desc: Joi.string().regex(/^\W*\w+(?:\W+\w+)*\W*$/).min(3).max(100).required(),
    since: Joi.date().iso()
  });

  const result = querySchema.validate(body);
  const { value, error } = result;
  const valid = error == null;
  var listings;
  if (!valid) {
    res.status(422).json({
      message: 'Invalid request',
      data: body,
      error: error
    })
  } else {
    listings = db.fuzzy(body.title_desc)
  }
  var then = Math.floor(new Date(body.since).getTime() / 1000)
  listings = db.since(then, listings)
  res.json({ title: 'Express', listings: db.toPublic(100, listings) });
});

/* Add one listing. */
const Joi = require('joi');
router.post('/add', async (req, res, next) => {
  const { body } = req;
  const listingSchema = Joi.object().keys({
    title: Joi.string().regex(/^\W*\w+(?:\W+\w+)*\W*$/).min(10).max(100).required(),
    desc: Joi.string().min(10).max(5000).required(),
    desc_: Joi.string().min(10).max(4000).required(),
    tags: Joi.array().items(Joi.string().min(3).max(20)).required()
  });
  var tags;
  var validJson = true
  try {
    tags = JSON.parse(body.tags)
    body.tags = _.pluck(tags, 'value')
  } catch (e) {
    validJson = false
  }
  const result = listingSchema.validate(body);
  const { value, error } = result;
  valid = (error == null) && validJson;
  if (!valid) {
    res.status(422).json({
      message: 'Invalid request',
      data: body,
      error: error
    })
  } else {
    var password = (Math.random().toString(36).substr(4)).slice(0, 9)
    var now = Math.floor(new Date().getTime() / 1000)
    // body.desc = sanitizeHtml(body.desc)

    body.desc = give.sanitize(body.desc)
    var entry = _.extend(body, { id: now, pass: password, d: 0 })
    var err = db.push(entry)
    // TODO: not here, in a cron job
    db.persist()
    if (!err)
      res.render('listing', { title: 'One listing', data: entry })
    else
      // if error
      res.status(500).json({
        message: 'Internal error: mapping posted object in /add',
        data: entry,
        error: err
      })
  }
});


/* Deactivate one listing. */
router.post('/deactivate', function (req, res, next) {
  const { body } = req;
  const listing = Joi.object().keys({
    password: Joi.string().min(6).max(9).required(),
  });
  const result = listing.validate(body);
  const { value, error } = result;
  const valid = error == null;
  if (!valid) {
    res.status(422).json({
      message: 'Invalid request',
      data: body,
      error: error
    })
  } else {
    var elem = db.get({ pass: body.password })
    db.deactivate(elem.id)
    res.render('messages', { title: 'Express', message: 'Item deactivated' });
  }
});


module.exports = router;
