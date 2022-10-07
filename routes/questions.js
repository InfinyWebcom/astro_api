/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const questController = require('../controllers/question');

router.post('/addQuestion',[
    check('question', 'Question is required').notEmpty(),
    check('answer', 'Answer is required').notEmpty()
  ], (req, res, next) => {
    questController.addQuestion(req, res); 
});

router.post('/questionListing', (req, res, next) => {
    questController.questionListing(req, res); 
});

module.exports = router;