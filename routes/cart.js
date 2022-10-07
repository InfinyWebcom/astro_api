/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const cartController = require('../controllers/cart');

router.post('/addtoCart', [
    check('product_id', 'Product id is required').notEmpty(),
    check('quantity', 'Quantity id is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('addtoCart')], (req, res, next) => {
    cartController.addtoCart(req, res);
});

router.post('/getCartDetails', [auth.authenticateUser, auth.isAuthenticated('getCartDetails')], (req, res, next) => {
  cartController.getCartDetails(req, res);
});

router.post('/removeFromCart', [
  check('product_id', 'Product id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('removeFromCart')], (req, res, next) => {
  cartController.removeFromCart(req, res);
});

module.exports = router;