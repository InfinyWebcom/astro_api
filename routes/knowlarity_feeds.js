/* NODE-MODULES */
const express = require('express');
const router = express.Router();
const auth = require('../lib/auth');
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const knowlarityFeedsController = require('../controllers/knowlarity_feeds');

router.post('', [
    check('call_date', 'Call date is required').notEmpty(),
    check('call_time', 'Call time is required').notEmpty(),
    check('consumer_number', 'Consumer number is required').notEmpty(),
    check('agent_number', 'Agent number is required').notEmpty(),
    check('call_duration', 'Call duration is required').notEmpty(),
    check('call_uuid', 'Call uuid is required').notEmpty()
  ], (req, res) => {
    knowlarityFeedsController.feeds(req, res)
})

module.exports = router;