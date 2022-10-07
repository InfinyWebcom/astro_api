/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");

/* CONTROLLER MODULES */
const offer = require('../controllers/offers');

router.post('/addOffer', [auth.authenticateUser], (req, res) => {
    offer.addOffer(req, res);
});

module.exports = router;