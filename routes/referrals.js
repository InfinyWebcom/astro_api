/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const referralController = require('../controllers/referral');

router.post('/getReferralList', [auth.authenticateUser, auth.isAuthenticated('getReferralList')], (req, res, next) => {
    referralController.getReferralList(req, res); 
});

router.post('/getReferralDetails', [
  check('referror_id', 'Referror id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('getReferralDetails')], (req, res, next) => {
  referralController.getReferralDetails(req, res); 
});

router.post('/validateReferral', [
    check('referral_code', 'Referral code is required').notEmpty() 
  ], (req, res, next) => {
    referralController.validateReferral(req, res); 
});

router.post('/addReferror', [
  check('first_name', 'First Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('user_type', 'User type is required').notEmpty(),
  check('mobile', 'Mobile is required').notEmpty(),
  check('referral_code', 'Referral code is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('addReferror')], (req, res, next) => {
  referralController.addReferror(req, res); 
});

router.post('/blockReferralCode', [
  check('referror_id', 'Referror id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('blockReferralCode')], (req, res, next) => {
  referralController.blockReferralCode(req, res); 
});

router.post('/referralTransactions', (req, res, next) => {
  referralController.referralTransactions(req, res); 
});

module.exports = router;