/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const ratingController = require('../controllers/rating');

router.post('/addRating', [
    check('from_id', 'From id is required').notEmpty(),
    check('to_id', 'To id is required').notEmpty(),
//    check('description', 'Description is required').notEmpty(),
//    check('rating_value', 'Rating is not valid').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('addRating')], (req, res, next) => {
    ratingController.addRating(req, res); 
});

module.exports = router;