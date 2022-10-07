/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const serviceController = require('../controllers/service');

router.post('/getServicesList', (req, res, next) => {
    serviceController.getServicesList(req, res); 
});

router.post('/addService', [
    check('name', 'Name is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('rate', 'Rate is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('addService')], (req, res, next) => {
    serviceController.addService(req, res); 
});

router.post('/editService', [
    check('name', 'Name is required').notEmpty(),
    check('description', 'Description is required').notEmpty(),
    check('rate', 'Rate is required').notEmpty(),
    check('service_id', 'Id is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('editService')], (req, res, next) => {
    serviceController.editService(req, res); 
});

router.post('/deleteService', [    
    check('service_id', 'Id is required').notEmpty()
  ], [auth.authenticateUser, auth.isAuthenticated('deleteService')], (req, res, next) => {
    serviceController.deleteService(req, res); 
});

router.post('/hideService', [    
  check('service_id', 'Id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('hideService')], (req, res, next) => {
  serviceController.hideService(req, res); 
});

router.post('/getServiceDetails', [    
  check('service_id', 'Id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('getServiceDetails')], (req, res, next) => {
  serviceController.getServiceDetails(req, res); 
});

router.post('/getProductsAndServices', [auth.authenticateUser, auth.isAuthenticated('getProductsAndServices')], (req, res, next) => {
  serviceController.getProductsAndServices(req, res); 
});

module.exports = router;