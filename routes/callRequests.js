/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const callRequestController = require('../controllers/callRequest');

router.post('/addCallRequest', [
    check('email', 'Email is required').notEmpty(),
    check('name', 'Name is required').notEmpty(),
    check('mobile', 'Mobile is required').notEmpty(),
    check('preferred_time', 'Preferred time is required').notEmpty()
  ], (req, res, next) => {
    callRequestController.addCallRequest(req, res); 
});

router.post('/scheduleCallRequest', [
    check('request_id', 'Request id is required').notEmpty(),
    check('astrologer_id', 'Astrologer id is required').notEmpty(),
    check('call_time', 'Call time is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('scheduleCallRequest')], (req, res, next) => {
    callRequestController.scheduleCallRequest(req, res); 
});

router.post('/completeCallRequest', [
    check('request_id', 'Request id is required').notEmpty(),
    check('request_status', 'Request status is required').notEmpty(),
  //  check('call_rate', 'Call rate is required').notEmpty(),
  //  check('call_duration', 'Call duration is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('completeCallRequest')], (req, res, next) => {
    callRequestController.completeCallRequest(req, res); 
});

router.post('/denyCallRequest', [
    check('request_id', 'Request id is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('denyCallRequest')], (req, res, next) => {
    callRequestController.denyCallRequest(req, res); 
});

router.post('/callRequestList', [auth.authenticateUser, auth.isAuthenticated('callRequestList')], (req, res, next) => {
  callRequestController.callRequestList(req, res); 
});

module.exports = router;