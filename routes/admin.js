/* NODE-MODULES */
const express = require('express');
const router = express.Router();
var auth = require("../lib/auth");
const CourierService = require('../lib/courierService')
const { check, validationResult, body } = require('express-validator');
const moment = require('moment')

/* CONTROLLER MODULES */
const adminController = require('../controllers/admin');

router.post('/login', [
  check('email', 'Email is required').notEmpty(),
  check('password', 'Password is required').notEmpty()
], (req, res, next) => {
  adminController.login(req, res);
});

router.post('/createAstrologer', [
  check('first_name', 'First Name is required').notEmpty(),
  //  check('last_name', 'Last Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('user_type', 'User type is required').notEmpty(),
  check('mobile', 'Mobile is required').notEmpty(),
  check('info', 'Info is required').notEmpty(),
  check('experience_years', 'Experience is required').notEmpty(),
  check('languages_spoken', 'Languages is required').notEmpty(),
  check('specialities', 'Specialities is required').notEmpty(),
  // check('block_number', 'Block is required').notEmpty(),
  // check('building_name', 'Building name is required').notEmpty(),
  // check('street_address', 'Street address is required').notEmpty(),
  // check('pincode', 'Pincode is required').notEmpty(),
  // check('user_city', 'City is required').notEmpty(),
  // check('user_state', 'State is required').notEmpty(),


  //  check('longitude', 'Longitude is required').notEmpty(),
  //  check('latitude', 'Latitude is required').notEmpty(),
  //  check('chat_rate', 'Chat rate is required').notEmpty(),
  //  check('video_rate', 'Video rate is required').notEmpty(),
  //  check('audio_rate', 'Audio rate is required').notEmpty(),
  //  check('report_rate', 'Report rate is required').notEmpty(),
  //  check('client_chat_rate', 'Chat rate is required').notEmpty(),
  //  check('client_video_rate', 'Video rate is required').notEmpty(),
  //  check('client_audio_rate', 'Audio rate is required').notEmpty(),
  //  check('client_report_rate', 'Report rate is required').notEmpty(),
  check('is_chat', 'Chat is required').notEmpty(),
  check('is_video', 'Video is required').notEmpty(),
  check('is_audio', 'Audio is required').notEmpty(),
  check('is_report', 'Report is required').notEmpty(),
  //check('profile_url', 'Profile image is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('createAstrologer')], (req, res, next) => {
  adminController.createAstrologer(req, res);
});

router.post('/editAstrologer', [
  check('first_name', 'First Name is required').notEmpty(),
  //  check('last_name', 'Last Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('user_type', 'User type is required').notEmpty(),
  check('mobile', 'Mobile is required').notEmpty(),
  check('info', 'Info is required').notEmpty(),
  check('experience_years', 'Experience is required').notEmpty(),
  check('languages_spoken', 'Languages is required').notEmpty(),
  check('specialities', 'Specialities is required').notEmpty(),
  check('user_id', 'User id is required').notEmpty(),
  // check('block_number', 'Block is required').notEmpty(),
  // check('building_name', 'Building name is required').notEmpty(),
  // check('street_address', 'Street address is required').notEmpty(),
  // check('pincode', 'Pincode is required').notEmpty(),
  // check('user_city', 'City is required').notEmpty(),
  // check('user_state', 'State is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('editAstrologer')], (req, res, next) => {
  adminController.editAstrologer(req, res);
});

router.post('/deleteUser', [
  check('user_id', 'User id is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('deleteUser')], (req, res, next) => {
  adminController.deleteUser(req, res);
});

router.post('/uploadCertifications', [auth.authenticateUser, auth.isAuthenticated('uploadCertifications')], (req, res, next) => {
  adminController.uploadCertifications(req, res);
});

router.post('/getAstrologerList', [auth.authenticateUser, auth.isAuthenticated('getAstrologerList')], (req, res, next) => {
  adminController.getAstrologerList(req, res);
});
router.post('/getAstrologerListApp', (req, res, next) => {
  adminController.getAstrologerList(req, res);
});

router.post('/getLanguagesList', (req, res, next) => {
  adminController.getLanguagesList(req, res);
});

router.post('/getSpecialitiesList', (req, res, next) => {
  adminController.getSpecialitiesList(req, res);
});

router.post('/getAstroSignsList', [auth.authenticateUser, auth.isAuthenticated('getAstroSignsList')], (req, res, next) => {
  adminController.getAstroSignsList(req, res);
});

router.post('/addAstroSign', [
  check('name', 'Name is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('addAstroSign')], (req, res, next) => {
  adminController.addAstroSign(req, res);
});

router.post('/addTipOfTheDay', [
  check('tip_date', 'Tip date is required').notEmpty(),
  check('tip', 'Tip is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('addTipOfTheDay')], (req, res, next) => {
  adminController.addTipOfTheDay(req, res);
});

router.post('/getTipOfTheDay', [
  check('tip_date', 'Tip date is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('getTipOfTheDay')], (req, res, next) => {
  adminController.getTipOfTheDay(req, res);
});

router.post('/getAllTips', [auth.authenticateUser, auth.isAuthenticated('getAllTips')], (req, res, next) => {
  adminController.getAllTips(req, res);
});

router.post('/getUserDetails', (req, res, next) => {
  adminController.getUserDetails(req, res);
});

router.post('/getUserRatings', [
  check('user_id', 'User id is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('getUserRatings')], (req, res, next) => {
  adminController.getUserRatings(req, res);
});

router.post('/deleteRating', [
  check('rating_id', 'rating id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('deleteRating')], (req, res, next) => {
  adminController.deleteRating(req, res);
});

router.post('/getConsumerList', [auth.authenticateUser, auth.isAuthenticated('getConsumerList')], (req, res, next) => {
  adminController.getConsumerList(req, res);
});

router.post('/blockUser', [
  check('user_id', 'User id is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('blockUser')], (req, res, next) => {
  adminController.blockUser(req, res);
});

router.post('/getUsersList', [auth.authenticateUser, auth.isAuthenticated('getUsersList')], (req, res, next) => {
  adminController.getUsersList(req, res);
});

router.post('/getYearList', [auth.authenticateUser, auth.isAuthenticated('getYearList')], (req, res, next) => {
  adminController.getYearList(req, res);
});

router.post('/changeReportStatus', [
  check('report_id', 'Report id is required').notEmpty(),
  check('report_status', 'Report status is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('changeReportStatus')], (req, res, next) => {
  adminController.changeReportStatus(req, res);
});

router.post('/getReportList', [auth.authenticateUser, auth.isAuthenticated('getReportList')], (req, res, next) => {
  adminController.getReportList(req, res);
});

router.post('/addPromotion', [
  check('description', 'Description id is required').notEmpty(),
  check('user_type', 'User type is required').notEmpty(),
], [auth.authenticateUser, auth.isAuthenticated('addPromotion')], (req, res, next) => {
  adminController.addPromotion(req, res);
});

router.post('/getPromotionList', [auth.authenticateUser, auth.isAuthenticated('getPromotionList')], (req, res, next) => {
  adminController.getPromotionList(req, res);
});

router.post('/getConsultCount', [auth.authenticateUser, auth.isAuthenticated('getConsultCount')], (req, res, next) => {
  adminController.getConsultCount(req, res);
});

router.post('/getNewOrdersList', [auth.authenticateUser, auth.isAuthenticated('getNewOrdersList')], (req, res, next) => {
  adminController.getNewOrdersList(req, res);
});

router.post('/getNewServiceRequests', [auth.authenticateUser, auth.isAuthenticated('getNewServiceRequests')], (req, res, next) => {
  adminController.getNewServiceRequests(req, res);
});

router.post('/getNewReportList', [auth.authenticateUser, auth.isAuthenticated('getNewReportList')], (req, res, next) => {
  adminController.getNewReportList(req, res);
});

router.post('/getAllConsultData', [auth.authenticateUser, auth.isAuthenticated('getAllConsultData')], (req, res, next) => {
  adminController.getAllConsultData(req, res);
});

router.post('/getSupportList', [auth.authenticateUser, auth.isAuthenticated('getSupportList')], (req, res, next) => {
  adminController.getSupportList(req, res);
});

router.post('/resolveTicket', [
  check('ticket_id', 'Ticket id is required').notEmpty()
], [auth.authenticateUser, auth.isAuthenticated('resolveTicket')], (req, res, next) => {
  adminController.resolveTicket(req, res);
});

router.post('/getTopSellingServices', [auth.authenticateUser, auth.isAuthenticated('getTopSellingServices')], (req, res, next) => {
  adminController.getTopSellingServices(req, res);
});

router.post('/getTopSellingProducts', [auth.authenticateUser, auth.isAuthenticated('getTopSellingProducts')], (req, res, next) => {
  adminController.getTopSellingProducts(req, res);
});

router.post('/getTopEarnAstrologers', [auth.authenticateUser, auth.isAuthenticated('getTopEarnAstrologers')], (req, res, next) => {
  adminController.getTopEarnAstrologers(req, res);
});

router.post('/addAstrologer', [
  check('first_name', 'First Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('user_type', 'User type is required').notEmpty(),
  check('mobile', 'Mobile is required').notEmpty(),
  check('experience_years', 'Experience is required').notEmpty(),
], (req, res, next) => {
  adminController.addAstrologer(req, res);
});

router.post('/shipRocketLogin', async (req, res) => {
  let data = await CourierService.reqgisterToShipRocket(req.body)
  console.log('data==', data.data)
  res.status(200).json({
    error: false,
    data: data.data
  })
})

router.post('/registerToShipRocket', [auth.authenticateUser], async (req, res) => {
  adminController.registerAdminToShipRocket(req, res)
})

router.post('/createOrder', [auth.authenticateUser], async (req, res) => {
  let orderData = {}
  orderData.order_id = req.body.order_id
  orderData.order_date = moment(req.user.createdAt).format("YYYY-MM-DD hh:mm")
  orderData.pickup_location = req.user.unique_name
  orderData.billing_customer_name = req.body.company
  orderData.billing_last_name = " "
  orderData.billing_address = req.body.address
  orderData.billing_city = req.body.user_city
  orderData.billing_state = req.body.state
  orderData.billing_country = 'India'
  orderData.billing_email = req.body.email
  orderData.billing_pincode = req.body.pincode
  orderData.billing_phone = req.body.phone
  orderData.shipping_is_billing = 1
  orderData.order_items = [{
    name: 'Astro', sku: 'gems',
    units: 1, selling_price: req.body.totalAmount, discount: 0
  }]
  orderData.weight = req.body.weight
  orderData.sub_total = req.body.totalAmount
  orderData.payment_method = req.body.type === 'COD' ? 'COD' : 'Prepaid'
  orderData.length = req.body.length
  orderData.breadth = req.body.breadth
  orderData.height = req.body.height
  let data = await CourierService.reqgisterToShipRocket(orderData)
  res.status(200).json(data)
})

router.post('/getStartedHome', [
  check('name', 'Name is required').notEmpty(),
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail(),
  check('message', 'Message is required').notEmpty()
], (req, res, next) => {
  adminController.getStartedHome(req, res)
});

router.post('/subscribeNewsLetter', [
  check('email', 'Email is required').notEmpty(),
  check('email', 'Email is not valid').isEmail()
], (req, res, next) => {
  adminController.subscribeNewsLetter(req, res)
});
router.post('/addContent', [auth.authenticateUser], (req, res) => {
  adminController.addContent(req, res)
})
router.post('/getContentByName', (req, res) => {
  adminController.getContentByName(req, res)
})

router.get('/astrologerList', [auth.authenticateUser], async (req, res) => {
  adminController.astrologerList(req, res)
})

router.post('/transactionStats', [auth.authenticateUser], async (req, res) => {
  adminController.transactionStats(req, res)
})

router.post('/getNewStats', [auth.authenticateUser], async (req, res) => {
  adminController.getNewStats(req, res)
})

module.exports = router;