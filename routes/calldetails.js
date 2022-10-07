/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const callController = require('../controllers/calldetail');

router.post('/getAstrologerStatus', [
    check('astrologer_id', 'Astrologer id is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('getAstrologerStatus')], (req, res, next) => {
    callController.getAstrologerStatus(req, res);
});

router.post('/makeVoiceCall', [
    check('astrologer_id', 'Astrologer id is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('makeVoiceCall')], (req, res, next) => {
    callController.makeVoiceCall(req, res);
});

router.post('/makeCall', (req, res, next) => {
    callController.makeCall(req, res);
});

router.post('/tokenGenerator', [auth.authenticateUser, auth.isAuthenticated('tokenGenerator')], (req, res, next) => {
    callController.tokenGenerator(req, res);
});

router.post('/callListing', [
    check('call_audio_video', 'Type is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('callListing')], (req, res, next) => {
    callController.callListing(req, res);
});

router.post('/voiceCallback', (req, res, next) => {
    callController.voiceCallback(req, res);
});

router.post('/makeVideoCall', [
    check('astrologer_id', 'Astrologer id is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('makeVoiceCall')], (req, res, next) => {
    callController.makeVideoCall(req, res);
});

router.post('/videoCallback', (req, res, next) => {
    callController.videoCallback(req, res);
});

router.post('/endVoiceCall', (req, res, next) => {
    callController.endVoiceCall(req, res);
});

router.post('/handleDialCallStatus', (req, res, next) => {
    callController.handleDialCallStatus(req, res);
});

router.post('/endVideoCall', [auth.authenticateUser], (req, res, next) => {
    callController.endVideoCall(req, res);
});

router.post('/makeVoiceCallNew', [auth.authenticateUser], (req, res, next) => {
    callController.makeVoiceCallNew(req, res);
});

module.exports = router;