/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const settleController = require('../controllers/settlement');

router.post('/createSettlement', [
    check('astrologer_id', 'Astrologer id is required').notEmpty()
  ], (req, res, next) => {
    settleController.createSettlement(req, res);
});

router.post('/getSettlementAstrologers', [auth.authenticateUser, auth.isAuthenticated('getSettlementAstrologers')], (req, res, next) => {
    settleController.getSettlementAstrologers(req, res);
});

router.post('/getSettlementsList', [
    check('astrologer_id', 'Astrologer id is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('getSettlementsList')], (req, res, next) => {
    settleController.getSettlementsList(req, res);
});

module.exports = router;