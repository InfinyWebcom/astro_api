/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const productController = require('../controllers/product');

router.post('/getProductsList', (req, res, next) => {
  productController.getProductsList(req, res);
});

router.post('/addProduct', [
  check('name', 'Name is required').notEmpty(),
  check('description', 'Description is required').notEmpty(),
  check('rate', 'Rate is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('addProduct')], (req, res, next) => {
  productController.addProduct(req, res);
});

router.post('/editProduct', [
  check('name', 'Name is required').notEmpty(),
  check('description', 'Description is required').notEmpty(),
  check('rate', 'Rate is required').notEmpty(),
  check('product_id', 'Id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('editProduct')], (req, res, next) => {
  productController.editProduct(req, res);
});

router.post('/deleteProduct', [
  check('product_id', 'Id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('deleteProduct')], (req, res, next) => {
  productController.deleteProduct(req, res);
});

router.post('/hideProduct', [
  check('product_id', 'Id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('hideProduct')], (req, res, next) => {
  productController.hideProduct(req, res);
});

router.post('/getProductDetails', [
  check('product_id', 'Id is required').notEmpty(),
], (req, res, next) => {
  productController.getProductDetails(req, res);
});

module.exports = router;