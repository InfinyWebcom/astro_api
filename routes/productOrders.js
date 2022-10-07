/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const orderController = require('../controllers/productOrder');

router.post('/createOrder', [auth.authenticateUser, auth.isAuthenticated('createOrder')], (req, res, next) => {
    orderController.createOrder(req, res);
});

router.post('/orderListing', [auth.authenticateUser, auth.isAuthenticated('orderListing')], (req, res, next) => {
    orderController.orderListing(req, res);
});

router.post('/orderDetails', [
    check('order_id', 'Order id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('orderDetails')], (req, res, next) => {
    orderController.orderDetails(req, res);
});

router.post('/getNewOrderCount', [auth.authenticateUser, auth.isAuthenticated('getNewOrderCount')], (req, res, next) => {
    orderController.getNewOrderCount(req, res);
});

router.post('/changeOrderStatus', [
    check('order_id', 'Order id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('changeOrderStatus')], (req, res, next) => {
    orderController.changeOrderStatus(req, res);
});

router.post('/orderCallback', (req, res, next) => {
    orderController.orderCallback(req, res);
});

router.post('/cancelProductOrder', [auth.authenticateUser], [check('order_id', 'Order id is required').notEmpty()], (req, res, next) => {
    orderController.cancelProductOrder(req, res);
});

router.post('/shipRocketWebhook', (req, res, next) => {
    orderController.shipRocketWebhook(req, res);
});

router.post('/markOrderDelivered', [auth.authenticateUser], [check('otp', 'Please enter the OTP').notEmpty(), check('order_id', 'Order ID is required').notEmpty()], (req, res, next) => {
    req.body.fromAdmin = true;
    req.body.current_status = 'Delivered';
    orderController.shipRocketWebhook(req, res);
});

router.post('/generateDeliveredOtp', [auth.authenticateUser], (req, res, next) => {
    orderController.generateDeliveredOtp(req, res);
});

module.exports = router;