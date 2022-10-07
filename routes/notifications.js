/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const notifController = require('../controllers/notification');

router.post('/notificationListing', [auth.authenticateUser, auth.isAuthenticated('notificationListing')], (req, res, next) => {
    notifController.notificationListing(req, res); 
});

router.post('/readNotifcations', [auth.authenticateUser, auth.isAuthenticated('readNotifcations')], (req, res, next) => {
    notifController.readNotifcations(req, res); 
});

module.exports = router;