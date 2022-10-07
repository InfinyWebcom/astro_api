/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const requestController = require('../controllers/serviceRequest');

router.post('/requestService', [
    check('service_id', 'Service id is required').notEmpty(),
    check('service_time', 'Date is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('requestService')], (req, res, next) => {
    requestController.requestService(req, res); 
});

router.post('/acceptDenyRequest', [
  check('request_id', 'Request id is required').notEmpty(),
  check('service_status', 'Status is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('acceptDenyRequest')], (req, res, next) => {
  requestController.acceptDenyRequest(req, res); 
});

router.post('/serviceRequestListing', [auth.authenticateUser, auth.isAuthenticated('serviceRequestListing')], (req, res, next) => {
  requestController.serviceRequestListing(req, res); 
});

router.post('/serviceRequestDetails', [auth.authenticateUser, auth.isAuthenticated('serviceRequestDetails')], (req, res, next) => {
  requestController.serviceRequestDetails(req, res); 
});

router.post('/cancelServiceRequest', [
  check('request_id', 'Request id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('cancelServiceRequest')], (req, res, next) => {
  requestController.cancelServiceRequest(req, res); 
});

router.post('/payFromPaymentLink', [
  check('request_id', 'Request id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('payFromPaymentLink')], (req, res, next) => {
  requestController.payFromPaymentLink(req, res); 
});

router.post('/completeRequest', [
  check('request_id', 'Request id is required').notEmpty(),
  check('request_otp', 'Request otp is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('completeRequest')], (req, res, next) => {
  requestController.completeRequest(req, res); 
});

router.post('/sendCompleteOtp', [
  check('request_id', 'Request id is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('sendCompleteOtp')], (req, res, next) => {
  requestController.sendCompleteOtp(req, res); 
});

router.post('/sendServiceStartedOtp', [
  check('request_id', 'Request id is required').notEmpty(),
], [auth.authenticateUser], (req, res, next) => {
  requestController.sendServiceStartedOtp(req, res); 
});

router.post('/markServiceStarted', [
  check('request_id', 'Request id is required').notEmpty(),
], [auth.authenticateUser], (req, res, next) => {
  requestController.markServiceStarted(req, res); 
});


module.exports = router;