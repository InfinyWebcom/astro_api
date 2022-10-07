/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const transController = require('../controllers/transaction');

router.post('/transactionsListing', [auth.authenticateUser, auth.isAuthenticated('transactionsListing')], (req, res, next) => {
    transController.transactionsListing(req, res); 
});

router.post('/walletTransactionList', [auth.authenticateUser, auth.isAuthenticated('walletTransactionList')], (req, res, next) => {
    transController.walletTransactionList(req, res); 
});

module.exports = router;