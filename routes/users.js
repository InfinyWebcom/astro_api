/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const { check, validationResult, body } = require('express-validator');

/* CONTROLLER MODULES */
const userController = require('../controllers/user');

router.post('/signin', [
  check('user_type', 'User type is required').notEmpty()
], (req, res, next) => {
  userController.signin(req, res);
});

router.post('/login', [
  check('user_type', 'User type is required').notEmpty()
], (req, res, next) => {
  userController.login(req, res);
});

router.post('/changePassword', [
  check('password', 'Password is required').notEmpty()
], [auth.authenticateUser], (req, res, next) => {
  userController.changePassword(req, res);
});

router.post('/forgotPassword', (req, res, next) => {
  userController.forgotPassword(req, res);
});

router.post('/verifyOTP', [
  check('verificationOtp', 'OTP is required').notEmpty()
], (req, res, next) => {
  userController.verifyOTP(req, res);
});

router.post('/userLogout', [auth.authenticateUser, auth.isAuthenticated('userLogout')], (req, res, next) => {
  userController.userLogout(req, res);
});

router.post('/validateEmail', (req, res, next) => {
  userController.validateEmail(req, res);
});

router.post('/sendTipOfTheDay', (req, res, next) => {
  userController.sendTipOfTheDay(req, res);
});

router.post('/signup', [
  check('first_name', 'First Name is required').notEmpty(),
  //  check('last_name', 'Last Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('user_type', 'User type is required').notEmpty(),
  check('mobile', 'Mobile is required').notEmpty(),
  // check('date_of_birth', 'date of birth is required').notEmpty(),
  //  check('gender', 'Gender is required').notEmpty(),
], (req, res, next) => {
  userController.signup(req, res);
});

router.post('/addSupport', [
  check('description', 'Description is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('addSupport')], (req, res, next) => {
  userController.addSupport(req, res);
});

router.post('/getTipOfTheDay', [auth.authenticateUser, auth.isAuthenticated('getTipOfTheDay')], (req, res, next) => {
  userController.getTipOfTheDay(req, res);
});

router.post('/getHoroscope', [
  check('astro_sign', 'Sign name is required').notEmpty()
], /*[auth.authenticateUser, auth.isAuthenticated('getHoroscope')], */(req, res, next) => {
  userController.getHoroscope(req, res);
});

router.post('/getMatchmaking', [
  check('male_date', 'Male date id is required').notEmpty(),
  check('female_date', 'Female date id is required').notEmpty(),
  check('m_lat', 'Male latitude is required').notEmpty(),
  check('m_lon', 'Male longitude is required').notEmpty(),
  check('f_lat', 'Female latitude is required').notEmpty(),
  check('f_lon', 'Male longitude is required').notEmpty()
], (req, res, next) => {
  userController.getMatchmaking(req, res);
});

router.post('/getKundali', [
  check('male_date', 'Male date id is required').notEmpty(),
  check('m_lat', 'Male latitude is required').notEmpty(),
  check('m_lon', 'Male longitude is required').notEmpty()
], (req, res, next) => {
  userController.getKundali(req, res);
});

router.post('/getPanchang', [
  check('male_date', 'Male date id is required').notEmpty(),
  check('m_lat', 'Male latitude is required').notEmpty(),
  check('m_lon', 'Male longitude is required').notEmpty()
], (req, res, next) => {
  userController.getPanchang(req, res);
});

router.post('/getAstrologerRatings', (req, res, next) => {
  userController.getAstrologerRatings(req, res);
});

router.post('/subscribeAstrologer', [
  check('astrologer_id', 'Astrologer id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('subscribeAstrologer')], (req, res, next) => {
  userController.subscribeAstrologer(req, res);
});

router.post('/getSummary', [
  check('consumer_id', 'Consumer id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('getSummary')], (req, res, next) => {
  userController.getSummary(req, res);
});

router.post('/editProfile', [
  check('first_name', 'First Name is required').notEmpty(),
  //  check('last_name', 'Last Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('mobile', 'Mobile is required').notEmpty(),
  // check('date_of_birth', 'date of birth is required').notEmpty(),
  //  check('gender', 'Gender is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('editProfile')], (req, res, next) => {
  userController.editProfile(req, res);
});

router.post('/removeListingFlag', [auth.authenticateUser, auth.isAuthenticated('removeListingFlag')], (req, res, next) => {
  userController.removeListingFlag(req, res);
});

router.post('/addWalletBalance', [
  check('wallet_balance', 'Balance is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('addWalletBalance')], (req, res, next) => {
  userController.addWalletBalance(req, res);
});

router.post('/textNotification', (req, res, next) => {
  userController.textNotification(req, res);
});

router.post('/getEarningsList', [auth.authenticateUser, auth.isAuthenticated('getEarningsList')], (req, res, next) => {
  userController.getEarningsList(req, res);
});

router.post('/editRateCard', [auth.authenticateUser, auth.isAuthenticated('editRateCard')], (req, res, next) => {
  userController.editRateCard(req, res);
});

router.post('/editAstroProfile', [
  check('first_name', 'First Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('mobile', 'Mobile is required').notEmpty(),
  check('info', 'Info is required').notEmpty(),
  check('experience_years', 'Experience is required').notEmpty(),
  check('languages_spoken', 'Languages is required').notEmpty(),
  check('specialities', 'Specialities is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('editAstroProfile')], (req, res, next) => {
  userController.editAstroProfile(req, res);
});

router.post('/getHomePageData', [
  check('consumer_id', 'Consumer id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('getHomePageData')], (req, res, next) => {
  userController.getHomePageData(req, res);
});

router.post('/testSMS', (req, res, next) => {
  userController.testSMS(req, res);
});

router.post('/changeMobile', [
  check('mobile', 'Mobile is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('changeMobile')], (req, res, next) => {
  userController.changeMobile(req, res);
});

router.post('/verifyMobileOTP', [
  check('mobile', 'Mobile is required').notEmpty(),
  check('verificationOtp', 'OTP is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('verifyMobileOTP')], (req, res, next) => {
  userController.verifyMobileOTP(req, res);
});

router.post('/getSupportCatList', [auth.authenticateUser, auth.isAuthenticated('getSupportCatList')], (req, res, next) => {
  userController.getSupportCatList(req, res);
});

router.post('/updateStatus', [auth.authenticateUser,], (req, res) => {
  userController.updateStatus(req, res)
})

router.post('/saveConsumerAddress', [
  auth.authenticateUser,
  check('block_number', 'Block number is required').notEmpty(),
  check('building_name', 'Building name is required').notEmpty(),
  check('street_address', 'Street address is required').notEmpty(),
  check('pincode', 'Pincode is required').notEmpty(),
  check('user_city', 'User city is required').notEmpty(),
  check('user_state', 'User state is required').notEmpty(),
  check('shipping_name', 'Shipping name is required').notEmpty(),
  check('shipping_number', 'Shipping number is required').notEmpty()
], (req, res) => {
  userController.saveConsumerAddress(req, res)
})

router.post('/deleteConsumerAddress', [
  auth.authenticateUser,
  check('address_id', 'Address id is required').notEmpty()
], (req, res) => {
  userController.deleteConsumerAddress(req, res)
})

router.post('/update-app', (req, res) => {
  userController.updateAppNotification(req, res)
})

router.post('/updateDeviceToken', [auth.authenticateUser], (req, res) => {
  userController.updateDeviceToken(req, res)
})

router.post('/unSubscribeAstrologer', [
  check('astrologer_id', 'Astrologer id is required').notEmpty()
], [auth.authenticateUser], (req, res, next) => {
  userController.unSubscribeAstrologer(req, res);
});

module.exports = router;