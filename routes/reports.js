/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const reportController = require('../controllers/report');

router.post('/requestReport', [
    check('astrologer_id', 'Astrologer id is required').notEmpty(),
    check('place', 'Place is required').notEmpty(),
    check('name', 'Name is required').notEmpty(),
    check('birth_date', 'Birth date id is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('requestReport')], (req, res, next) => {
    reportController.requestReport(req, res);
});

router.post('/uploadReport', [
  check('report_id', 'Report id is required').notEmpty(),
  check('report_url', 'Report url is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('uploadReport')], (req, res, next) => {
  reportController.uploadReport(req, res);
});

router.post('/cancelReport', [
  check('report_id', 'Report id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('cancelReport')], (req, res, next) => {
  reportController.cancelReport(req, res);
});

router.post('/getReportTemplate', [auth.authenticateUser, auth.isAuthenticated('getReportTemplate')], (req, res, next) => {
  reportController.getReportTemplate(req, res);
});

module.exports = router;