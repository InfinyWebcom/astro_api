/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
const moment = require('moment');
const nodeSchedule = require('node-schedule');
const Razorpay = require('razorpay')
var shortUrl = require('node-url-shortener');

/* Models */
const serviceModel = require('../models/service');
const userModel = require('../models/user');
const requestModel = require('../models/serviceRequest')
const transModel = require('../models/transaction');
const chatSessionModel = require('../models/chatSession');

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

/*
# parameters: token,
# purpose: request service by consumer
*/
const requestService = async (req, res) => {
    console.log('requestService req.body', req.body)
    console.log('requestService req.user---', req.user)

    const result = validationResult(req);

    console.log('requestService errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await serviceModel.getServiceById(req.body);
    console.log('requestService serviceData ', serviceData);

    if (!serviceData) {
        return res.status(200).json({
            title: 'No service found',
            error: true,
        });
    }

    let addressesObj = {};
    let index = -1;
    if (req.body.address_id) {
        index = req.user.addresses.findIndex((e) => e._id.toString() == req.body.address_id.toString())
        addressesObj = {
            block_number: req.user.addresses[index].block_number,
            building_name: req.user.addresses[index].building_name,
            street_address: req.user.addresses[index].street_address,
            pincode: req.user.addresses[index].pincode,
            user_city: req.user.addresses[index].user_city,
            user_state: req.user.addresses[index].user_state,
            user_location: req.user.addresses[index].user_location,
            shipping_name: req.user.addresses[index].shipping_name,
            shipping_number: req.user.addresses[index].shipping_number,
        }
    }

    //unique number
    var product_number = randomstring.generate(7);
    var newRequest = new requestModel({
        service_id: req.body.service_id,
        service_time: moment.tz(req.body.service_time, helper.getTimezone()).utc(), //new Date(req.body.service_time), //2020-08-20 04:40 am or 2020-08-20 16:40
        consumer_id: req.user._id,
        rate: parseFloat(serviceData.rate).toFixed(2),
        product_number: product_number,
        user_address: addressesObj
    })

    var res_title = 'Request sent successfully'

    let use_wallet = false;
    let wallet_amt_used = 0;
    async.waterfall([
        function (firstCallback) {
            //check if user selected wallet option            
            var payAmount = serviceData.rate
            if (req.body.is_wallet && (req.body.is_wallet == true || req.body.is_wallet == 'true') && req.user.wallet_balance > 0) {
                use_wallet = true;

                var transAmount = 0
                var pendingAmt = req.user.wallet_balance - serviceData.rate
                if (pendingAmt >= 0) {
                    req.user.wallet_balance = parseFloat(req.user.wallet_balance - serviceData.rate).toFixed(2)
                    transAmount = serviceData.rate
                    payAmount = 0

                    //request success from wallet
                    newRequest.service_status = "New"
                }
                else {
                    transAmount = req.user.wallet_balance
                    wallet_amt_used = req.user.wallet_balance
                    payAmount = parseFloat(serviceData.rate - req.user.wallet_balance).toFixed(2)
                    //    req.user.wallet_balance = 0
                    use_wallet = true
                }

                console.log('requestService firstCallback transAmount ', transAmount, payAmount);

                newRequest.save((error, savedRequest) => {
                    console.log('requestService else---', error, savedRequest)

                    if (error) {
                        return firstCallback(null, true, undefined);
                    }
                    if (pendingAmt >= 0) {
                        //to save transaction
                        var transData = new transModel({
                            transaction_type: 'service',
                            consumer_id: req.user._id,
                            service_req_id: savedRequest._id,
                            payment_status: "success",
                            payment_type: "wallet",
                            pay_type: "first",
                            transaction_amt: transAmount,
                            client_transaction_amt: transAmount
                        })
                        transModel.saveTransaction(transData, (err, savedData) => {
                            console.log('requestService wallet savedData', err, savedData);

                            if (err) {
                                return firstCallback(null, true, undefined);
                            }
                            req.user.save((error, savedUser) => {
                                console.log('requestService savedTrans---', error, savedUser)

                                if (error) {
                                    return firstCallback(null, true, undefined);
                                }

                                return firstCallback(null, false, payAmount);
                            })
                        })
                    }
                    else {
                        console.log('requestService CHECK 5.2');
                        req.user.save((error, savedUser) => {
                            console.log('requestService savedTrans---', error, savedUser)

                            if (error) {
                                return firstCallback(null, true, undefined);
                            }

                            return firstCallback(null, false, payAmount);
                        })
                    }
                })
            }
            else {
                console.log('requestService firstCallback else');
                return firstCallback(null, false, payAmount);
            }
        },
        function (err, payAmount, secCallback) {
            console.log('requestService secCallback payAmount---', err, payAmount)

            if (err) {
                return secCallback(error, true)
            }
            if (payAmount > 1) {
                res_title = "Please pay the amount to sent request."
                //razor pay
                var instance = new Razorpay({ key_id: process.env.razor_key_id, key_secret: process.env.razor_key_secret })
                var options = {
                    amount: parseFloat(payAmount).toFixed(2) * 100,  // amount in the smallest currency unit
                    currency: "INR",
                    receipt: product_number,
                    notes: {
                        order_type: 'service',
                        use_wallet: use_wallet,
                        wallet_amt_used: wallet_amt_used
                    }
                };
                instance.orders.create(options, function (err, order) {
                    console.log('requestService razor instance err', err);
                    if (err) {
                        return secCallback(err, true)
                    }

                    console.log('requestService razor instance order', order);

                    newRequest.pay_order_id = order.id
                    newRequest.pay_receipt = order.receipt
                    newRequest.payment_status = 'pending'

                    newRequest.save((error, savedRequest) => {
                        console.log('requestService error---', error)

                        if (error) {
                            return secCallback(error, true)
                        }

                        var data = new Object();
                        data = savedRequest.toObject({ getters: true })
                        data.payAmount = parseFloat(payAmount).toFixed(2)
                        return secCallback(null, data)
                    })
                })
            } else {
                newRequest.payment_status = 'success'

                //to consumer
                let consData = req.user
                var msg = "We're at your service! Your service request for " + serviceData.name + " has been placed successfully and ₹ " + parseFloat(serviceData.rate).toFixed(2) + " has been deducted from your registered Astrowize wallet."
                let consumerData = {
                    msg: msg,
                    title: "",
                    device_token: consData.device_token,
                    data: {
                        message: msg,
                        flag: "Service Requested",
                        request_id: newRequest._id,
                        targetedScreen: "service_list"
                    }
                }
                consumerData.data.user_id = req.user._id
                notificationController.sendNotification(consumerData)

                //sent mail to consumer
                let mailData = {
                    email: consData.email,
                    subject: 'AstroWize - Service request placed successfully!',
                    body:
                        "<p>" +
                        "Hello " + "Admin" + "," +
                        "<p>" +
                        "Your service request for " + serviceData.name + " has been placed successfully and ₹ " + parseFloat(serviceData.rate).toFixed(2) + " has been deducted from your registered Astrowize wallet." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)

                //sms
                var smsData = {}
                smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
                // smsData.template_id = "6d9e23ed-84ac-411b-99b3-55c6dd6390c6"
                smsData.template_id = "1707160828903322300"
                smsData.message = "Hello " + consData.first_name + ", \n Your service request for " + serviceData.name + " has been placed successfully and ₹ " + parseFloat(serviceData.rate).toFixed(2) + " has been deducted from your registered AstroWize wallet. Thanks, FINOTO."
                let sms = helper.sendSMS(smsData)

                //sent mail to admin
                let adminMsgBody = msg
                let adminMailData = {
                    email: process.env.mail_username,
                    subject: 'Service Request',
                    body:
                        '<p>' + adminMsgBody
                };
                helper.sendEmail(adminMailData)

                newRequest.save((error, savedRequest) => {
                    console.log('requestService else---', error, savedRequest)

                    if (error) {
                        return secCallback(error, true)
                    }
                    var data = new Object();
                    data = savedRequest.toObject({ getters: true })
                    data.payAmount = parseFloat(payAmount).toFixed(2)
                    return secCallback(null, data)
                })
            }
        }
    ], function (err, savedRequest) {
        console.log('requestService funtion err -- ', err)
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }
        return res.status(200).json({
            title: res_title,
            error: false,
            data: savedRequest
        });
    })
}

/*
# parameters: token,
# purpose: accept/deny service request by admin
*/
const acceptDenyRequest = async (req, res) => {
    console.log('acceptDenyRequest req.body', req.body)
    console.log('acceptDenyRequest req.user---', req.user)

    const result = validationResult(req);

    console.log('acceptDenyRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await requestModel.getRequestById(req.body);
    console.log('acceptDenyRequest serviceData ', serviceData);

    serviceData.service_status = req.body.service_status
    if (req.body.service_status == 'Approved') {
        serviceData.astrologer_id = req.body.astrologer_id
        serviceData.rate = parseFloat(req.body.rate).toFixed(2)
        serviceData.assigned_time = new Date()

        transModel.updateMany({ 'service_req_id': serviceData._id }, { astrologer_id: req.body.astrologer_id })
            .exec((err, saveData) => {
                console.log('acceptDenyRequest saveData err========', err, saveData);
            })
    }

    serviceData.save((error, savedRequest) => {
        console.log('acceptDenyRequest savedRequest---', error, savedRequest)

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again',
                error: true,
            });
        }

        serviceData
        .populate('consumer_id')
        .populate('astrologer_id')
        .populate('service_id')
        .execPopulate()
        .then(function (request) {
            console.log('serviceData request---', request)

            if (req.body.service_status == 'Approved') {
                var serviceTime = moment.tz(serviceData.service_time, helper.getTimezone()).format('MMM DD, YYYY hh:mm a') //MMM DD, YYYY //YYYY-MM-DD
                console.log('acceptDenyRequest time--', serviceTime);

                var astrologerMsg = "Seva ka waqt! You have received a service request. Click here to know more."//'You have a service scheduled at: ' + serviceTime
                var consumerMsg = "Your service request for " + request.service_id.name + " has been confirmed and " + request.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + ". Our Astrologers follow all safety and precautionary measures."   //'Your service has been assigned + serviceTime

                let consumerSmsMsg = "Your service request for " + request.service_id.name + " has been confirmed and " + request.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + ". Our astrologers follow all safety and precautionary measures. Thank you for using our services, FINOTO."//'Your service has been assigned to: ' + request.astrologer_id.first_name + ' at: ' + serviceTime
                var template_id_consumer = "1707160829012518301"

                var consumerMailMsg = "Your service request for " + request.service_id.name + " has been confirmed and " + request.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + ". Our astrologers follow all safety and precautionary measures." +
                    "<p>" +
                    "Thank you for using our services."//'Your service has been assigned to: ' + request.astrologer_id.first_name + ' at: ' + serviceTime

                var payUrl = ""
                async.waterfall([
                    function (firstCallback) {
                        //send mail if need more amount
                        console.log('serviceData rate diff---', parseFloat(req.body.rate).toFixed(2), parseFloat(request.service_id.rate).toFixed(2))
                        var remain_amt = parseFloat(req.body.rate) - parseFloat(request.service_id.rate)

                        if (remain_amt >= 1) {

                            //changed msg if rate is more                            
                            consumerMsg = 'Your service has been assigned to: ' + request.astrologer_id.first_name + ' at: '
                                + serviceTime + '. You have to pay: ' + parseFloat(remain_amt).toFixed(2)

                            savedRequest.payment_status = 'pending'
                            savedRequest.remain_amt = parseFloat(remain_amt).toFixed(2)

                            savedRequest.save((error, savedReq) => {
                                if (error) {
                                    console.log('acceptDenyRequest error---', error)
                                    return firstCallback(null, undefined);
                                }

                                var url = 'https://astrowize.com/pay?request_id=' + request._id //'myapplication://deeplink'
                                payUrl = url 
                                consumerMailMsg = 'Your service has been assigned to: ' + request.astrologer_id.first_name + ' at: ' + serviceTime + '. <br><br>\n\nPlease ' + '<a href="' + url + '">click here</a>' + ' to pay the remaining amount ' + parseFloat(remain_amt).toFixed(2)
                                consumerMsg = 'Your service has been assigned to: ' + request.astrologer_id.first_name + ' at: ' + serviceTime + '. Confirm this paying remaining amount ' + parseFloat(remain_amt).toFixed(2)
                                consumerSmsMsg = 'Your service has been assigned to ' + request.astrologer_id.first_name + ' at ' + serviceTime + '. Please click below link to confirm and pay the remaining amount. '// + parseFloat(remain_amt).toFixed(2)
                                template_id_consumer = "1707161859079565532"
                                console.log('html after -- ', consumerMailMsg);

                                let currentTime = new Date(Date.now());


                                // 12 HOURS
                                let notifyPaymentTwelveTime = new Date(currentTime.getTime() + 43200000);
                                let randStringTwelve = randomstring.generate(7);

                                let twelveEndSession = new chatSessionModel({
                                    schedule_name: randStringTwelve + 'notify_payment_twelve',
                                    service_req_id: serviceData._id,
                                    schedule_type: 'notify_payment_twelve',
                                    start_date: notifyPaymentTwelveTime
                                })

                                twelveEndSession.save((err, sessiondata) => {
                                    let notifyPaymentTwelve = nodeSchedule.scheduleJob(randStringTwelve + 'notify_payment_twelve', notifyPaymentTwelveTime, () => {

                                        let msgTemp = { consumerMailMsg: consumerMailMsg, consumerMsg: consumerMsg, consumerSmsMsg: consumerSmsMsg, template_id: '0f7c3bc7-ceb4-4807-8d39-f66f76ebac99' }

                                        notifyServicePayment(req, msgTemp)

                                        // CANCEL SCHEDULE
                                        var myScheduleJob = nodeSchedule.scheduledJobs[randStringTwelve + 'notify_payment_twelve'];
                                        if (myScheduleJob != undefined) {
                                            myScheduleJob.cancel();
                                        }

                                        chatSessionModel.deleteMany({ schedule_name: randStringTwelve + 'notify_payment_twelve' }, (error, data) => {
                                            console.log('twelveEndSession deleteMany ', error, data);
                                        });

                                    })
                                })

                                // 18 HOURS
                                let notifyPaymentEighteenTime = new Date(currentTime.getTime() + 64800000);
                                let randStringEighteen = randomstring.generate(7);

                                let eighteenEndSession = new chatSessionModel({
                                    schedule_name: randStringEighteen + 'notify_payment_eighteen',
                                    service_req_id: serviceData._id,
                                    schedule_type: 'notify_payment_eighteen',
                                    start_date: notifyPaymentEighteenTime
                                })

                                eighteenEndSession.save((err, sessiondata) => {
                                    let notifyPaymentTwelve = nodeSchedule.scheduleJob(randStringEighteen + 'notify_payment_eighteen', notifyPaymentEighteenTime, () => {

                                        let msgTemp = { consumerMailMsg: consumerMailMsg, consumerMsg: consumerMsg, consumerSmsMsg: consumerSmsMsg }

                                        notifyServicePayment(req, msgTemp)

                                        // CANCEL SCHEDULE
                                        var myScheduleJob = nodeSchedule.scheduledJobs[randStringEighteen + 'notify_payment_eighteen'];
                                        if (myScheduleJob != undefined) {
                                            myScheduleJob.cancel();
                                        }

                                        chatSessionModel.deleteMany({ schedule_name: randStringEighteen + 'notify_payment_eighteen' }, (error, data) => {
                                            console.log('eighteenEndSession deleteMany ', error, data);
                                        });

                                    })
                                })

                                // 24 HOURS - CANCEL SERVICE REQUEST AND NOTIFY CONSUMER
                                let cancelServiceReqTime = new Date(currentTime.getTime() + 86400000);
                                let randString = randomstring.generate(7);

                                let cancelServiceReqSession = new chatSessionModel({
                                    schedule_name: randString + 'cancel_service_req',
                                    service_req_id: serviceData._id,
                                    schedule_type: 'cancel_service_req',
                                    start_date: cancelServiceReqTime
                                })

                                cancelServiceReqSession.save((err, sessiondata) => {
                                    let cancelServiceReq = nodeSchedule.scheduleJob(randString + 'cancel_service_req', cancelServiceReqTime, () => {

                                        cancelServiceReqScheduler(req)

                                        // CANCEL SCHEDULE
                                        var myScheduleJob = nodeSchedule.scheduledJobs[randString + 'cancel_service_req'];
                                        if (myScheduleJob != undefined) {
                                            myScheduleJob.cancel();
                                        }

                                        chatSessionModel.deleteMany({ schedule_name: randString + 'cancel_service_req' }, (error, data) => {
                                            console.log('twentyfourEndSession deleteMany ', error, data);
                                        });

                                    })
                                })


                                return firstCallback(null, savedReq);
                            })

                        }
                        else {
                            //otp for completing service
                            savedRequest.service_status = "Scheduled"
                            savedRequest.save((error, savedReq) => {
                                console.log('acceptDenyRequest error---', error)

                                if (error) {
                                    return firstCallback(null, undefined);
                                }

                                console.log('acceptDenyRequest else')
                                return firstCallback(null, savedReq);
                            })
                        }
                    },
                    function (data, secCallback) {
                        console.log('acceptDenyRequest call -- ', data)

                        if (!data) {
                            return secCallback(true)
                        }
                        console.log('serviceData request.astrologer_id.email---', request.astrologer_id.email)

                        var mail_sub = "AstroWize - Service request confirmed!"
                        var push_flag = "Service Accepted"

                        if (data.service_status == "Scheduled") {
                            //send mail to astrologer
                            let mailAstrologer = {
                                email: request.astrologer_id.email,
                                subject: 'Service request assigned',
                                body:
                                    "<p>" +
                                    "Hello " + request.astrologer_id.first_name + "," +
                                    "<p>" +
                                    "A service request for " + request.service_id.name + " has been assigned to you at " + request.consumer_id.first_name + "'s place at " + serviceTime + ". To accept, head over to Astrowize app. Thank you." +
                                    "<p>" +
                                    "Regards," +
                                    "<br>" +
                                    "Team AstroWize"
                            };  //'<p>' + astrologerMsg
                            helper.sendEmail(mailAstrologer);

                            //to astrologer
                            let astrologerData = {
                                msg: astrologerMsg,
                                title: "",
                                device_token: request.astrologer_id.device_token,
                                data: {
                                    message: astrologerMsg,
                                    flag: "Service Scheduled",
                                    targetedScreen: "service_list"
                                }
                            }
                            astrologerData.data.user_id = request.astrologer_id._id
                            astrologerData.data.sec_user_id = request.consumer_id._id
                            notificationController.sendNotification(astrologerData)

                            mail_sub = "Service Scheduled"
                            push_flag = "Service Scheduled"

                            //sms to astrologer
                            var smsData = {}
                            smsData.to = ['91' + request.astrologer_id.mobile.replace(/\D/g, '')]
                            smsData.template_id = "1707160828912009816"
                            smsData.message = "Hello " + request.astrologer_id.first_name + ",\nA service request for " + request.service_id.name + " has been assigned to you at " + request.consumer_id.first_name + "'s place at " + serviceTime + ". To accept, head over to AstroWize app. Thanks, FINOTO."
                            let sms = helper.sendSMS(smsData)
                        }

                        //to consumer
                        let mailConsumer = {
                            email: request.consumer_id.email,
                            subject: mail_sub,
                            body:
                                "<p>" +
                                "Hello " + request.consumer_id.first_name + "," +
                                "<p>" +
                                consumerMailMsg +
                                "<p>" +
                                "Regards," +
                                "<br>" +
                                "Team AstroWize"
                        };
                        helper.sendEmail(mailConsumer);

                        //to consumer
                        let consumerData = {
                            msg: consumerMsg,
                            title: "",
                            device_token: request.consumer_id.device_token,
                            data: {
                                message: consumerMsg,
                                flag: push_flag,
                                request_id: request._id,
                                targetedScreen: "service_list"
                            }
                        }
                        consumerData.data.sec_user_id = request.astrologer_id._id
                        consumerData.data.user_id = request.consumer_id._id
                        notificationController.sendNotification(consumerData)

                        //sms to consumer
                        console.log('acceptDenyRequest fun consumerSmsMsg -- ', consumerSmsMsg)
                        /*
                        var smsConsumerData = {}
                        smsConsumerData.to = ['91' + request.consumer_id.mobile.replace(/\D/g, '')]
                        smsConsumerData.template_id = template_id_consumer
                        smsConsumerData.message = "Hello " + request.consumer_id.first_name + ", " + consumerSmsMsg
                        let smsConsumer = helper.sendSMS(smsConsumerData)
                        console.log('acceptDenyRequest fun smsConsumer -- ', smsConsumer)
                        */

                        if (payUrl != "") {
                            //create shorturl and send
                            shortUrl.short(payUrl, function(err, shorturl){
                                console.log('acceptDenyRequest errUrl ', err);
                                console.log('-=-=-=-shorturl->',shorturl);
                                let url = shorturl

                                console.log('acceptDenyRequest url ', url);
                                console.log('\n\nShort consumerSmsMsg TEXT : ', consumerSmsMsg);

                                let consumerSmsMsgUrl = consumerSmsMsg + url  + ' Thanks, FINOTO.'
                                console.log('\n\nShort url : ', consumerSmsMsgUrl);

                                let smsConsumerData = {}
                                smsConsumerData.to = ['91' + request.consumer_id.mobile.replace(/\D/g, '')]
                                // smsConsumerData.template_id = '1707162005812177123'
                                smsConsumerData.message = "Hello " + request.consumer_id.first_name + ", " + consumerSmsMsgUrl
                                smsConsumerData.template_id = '0f7c3bc7-ceb4-4807-8d39-f66f76ebac99'

                                let smsConsumer = helper.sendSMS(smsConsumerData)      

                            });
                        }
                        
                        return secCallback(null)
                    }
                ], function (err) {
                    console.log('acceptDenyRequest fun err -- ', err)
                    if (err) {
                        return res.status(200).json({
                            title: 'Something went wrong, Please try again..',
                            error: true,
                        });
                    }
                    return res.status(200).json({
                        title: 'Request approved successfully.',
                        error: false,
                        data: savedRequest
                    });
                })
            }
            else if (req.body.service_status == 'Denied') {
                var consumerMsg = "Uh-oh! Your service request for " + request.service_id.name + " has been cancelled and ₹ " + parseFloat(request.rate).toFixed(2) + " has been restored in your Astrowize wallet."

                //to consumer
                let consumerData = {
                    msg: consumerMsg,
                    title: "",
                    device_token: request.consumer_id.device_token,
                    data: {
                        message: consumerMsg,
                        request_id: request._id,
                        flag: "Service Cancelled",
                        targetedScreen: "service_list"
                    }
                }
                consumerData.data.user_id = request.consumer_id._id
                notificationController.sendNotification(consumerData)

                //sent mail to consumer
                let mailData = {
                    email: request.consumer_id.email,
                    subject: 'AstroWize - Service request cancelled!',
                    body:
                        "<p>" +
                        "Hello " + request.consumer_id.first_name + "," +
                        "<p>" +
                        "Your service request for " + request.service_id.name + " has been cancelled and ₹ " + parseFloat(request.rate).toFixed(2) + " has been restored in your Astrowize wallet." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)

                //refund to wallet
                let wallet_balance = parseFloat(request.consumer_id.wallet_balance + savedRequest.rate).toFixed(2)
                console.log('acceptDenyRequest wallet_balance---', request.consumer_id.wallet_balance, '---', wallet_balance)

                let consData = request.consumer_id
                consData.wallet_balance = wallet_balance
                request.consumer_id.wallet_balance = wallet_balance

                request.consumer_id.save((error, savedUser) => {
                    console.log('acceptDenyRequest savedTrans---', error, savedUser)

                    if (error) {
                        return res.status(200).json({
                            title: 'Something went wrong, Please try again..',
                            error: true,
                        });
                    }
                    //to save transaction
                    var transData = new transModel({
                        transaction_type: 'service',
                        consumer_id: request.consumer_id._id,
                        service_req_id: request._id,
                        payment_status: "success",
                        payment_type: "wallet",
                        pay_type: "refund",
                        transaction_amt: request.rate,
                        client_transaction_amt: request.rate
                    })

                    transModel.saveTransaction(transData, (err, savedData) => {
                        console.log('jobSeeker in events savedData', err, savedData);

                        if (err) {
                            return res.status(200).json({
                                title: 'Something went wrong, Please try again..',
                                error: true,
                            });
                        }
                        return res.status(200).json({
                            title: 'Request denied successfully.',
                            error: false,
                            data: savedRequest
                        });
                    })

                })
            }
        })
    })
}

/*
# parameters: token,
# purpose: service request listing
*/
const serviceRequestListing = async (req, res) => {
    console.log('serviceRequestListing req.body', req.body)
    console.log('serviceRequestListing req.user---', req.user)

    let data = await requestModel.getRequests(req);
    let isData = data.length == 0 ? false : true

    console.log('serviceRequestListing requestData ', data);

    return res.status(200).json({
        title: 'Order listing',
        error: false,
        data: isData ? data[0].data : [],
        wallet_balance: req.user.wallet_balance,
        total_count: isData ? data[0].totalCount : 0
    });
}

/*
# parameters: token,
# purpose: service request details
*/
const serviceRequestDetails = async (req, res) => {
    console.log('serviceRequestDetails req.body', req.body)
    console.log('serviceRequestDetails req.user---', req.user)

    let serviceData = await requestModel.getRequestById(req.body);
    console.log('serviceRequestDetails serviceData ', serviceData);

    if (!serviceData) {
        return res.status(200).json({
            title: 'No service found',
            error: true,
        });
    }

    return res.status(200).json({
        title: 'Service details',
        error: false,
        data: serviceData
    });
}

/*
# parameters: token,
# purpose: cancel service request by consumer
*/
const cancelServiceRequest = async (req, res) => {
    console.log('cancelServiceRequest req.body', req.body)
    console.log('cancelServiceRequest req.user---', req.user)

    const result = validationResult(req);

    console.log('cancelServiceRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await requestModel.getRequestById(req.body);
    console.log('cancelServiceRequest serviceData ', serviceData);

    if (!serviceData) {
        return res.status(200).json({
            title: 'No service found',
            error: true,
        });
    }
    if (serviceData.service_status == "Cancelled") {
        return res.status(200).json({
            title: 'You already cancelled this service',
            error: true,
        });
    }

    serviceData.service_status = "Cancelled"

    serviceData.save((error, savedRequest) => {
        console.log('cancelServiceRequest savedRequest---', error, savedRequest)

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again',
                error: true,
            });
        }

        //refund to wallet
        var return_amt = serviceData.rate
        if (serviceData.payment_status == 'pending') {
            return_amt = serviceData.rate - serviceData.remain_amt
        }
        let wallet_balance = parseFloat(req.user.wallet_balance + return_amt).toFixed(2)
        console.log('cancelServiceRequest wallet_balance---', req.user.wallet_balance, '---', wallet_balance)

        let consData = req.user
        consData.wallet_balance = wallet_balance

        consData.save((error, savedUser) => {
            console.log('cancelServiceRequest savedUser---', error, savedUser)

            if (error) {
                return res.status(200).json({
                    title: 'Something went wrong, Please try again..',
                    error: true,
                });
            }

            // send mail to astrologer
            if (serviceData.astrologer_id != null && serviceData.astrologer_id != undefined && serviceData.astrologer_id != '') {

                let mailAstrologer = {
                    email: serviceData.astrologer_id.email,
                    subject: 'AstroWize - Service request cancelled!',
                    body:
                        "<p>" +
                        "Hello " + serviceData.astrologer_id.first_name + "," +
                        "<p>" +
                        "The " + serviceData.service_id.name + " assigned to you has been cancelled. Visit the app to know why." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailAstrologer);

                //to astrologer
                var astrologerMsg = "Out of service! The service assigned to you was cancelled. Click here to know why."
                let astrologerData = {
                    msg: astrologerMsg,
                    title: "",
                    device_token: serviceData.astrologer_id.device_token,
                    data: {
                        message: astrologerMsg,
                        flag: "Service Cancelled",
                        targetedScreen: "service_list"
                    }
                }
                astrologerData.data.user_id = serviceData.astrologer_id._id
                astrologerData.data.sec_user_id = serviceData.consumer_id._id

                notificationController.sendNotification(astrologerData)

                //sms to astrologer
                var smsData = {}
                smsData.to = ['91' + serviceData.astrologer_id.mobile.replace(/\D/g, '')]
                smsData.template_id = "1707160829020038554"
                smsData.message = "Hello " + serviceData.astrologer_id.first_name + ",\n\nThe " + serviceData.service_id.name + " assigned to you has been cancelled. Visit the app to know why. Thanks, FINOTO."
                let sms = helper.sendSMS(smsData)

            }

            //to consumer
            var msg = "Uh-oh! Your service request for " + serviceData.service_id.name + " has been cancelled and ₹ " + parseFloat(return_amt).toFixed(2) + " has been restored in your Astrowize wallet."
            let consumerData = {
                msg: msg,
                title: "",
                device_token: consData.device_token,
                data: {
                    message: msg,
                    flag: "Service Cancelled",
                    request_id: serviceData._id,
                    targetedScreen: "service_list"
                }
            }
            consumerData.data.user_id = consData._id
            notificationController.sendNotification(consumerData)

            //sent mail to consumer
            let mailData = {
                email: consData.email,
                subject: 'AstroWize - Service request cancelled!',
                body:
                    "<p>" +
                    "Hello " + consData.first_name + "," +
                    "<p>" +
                    "Your service request for " + serviceData.service_id.name + " has been cancelled and ₹ " + parseFloat(return_amt).toFixed(2) + " has been restored in your Astrowize wallet." +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData)

            //to save transaction
            var transData = new transModel({
                transaction_type: 'service',
                consumer_id: consData._id,
                service_req_id: savedRequest._id,
                payment_status: "success",
                payment_type: "wallet",
                pay_type: "refund",
                transaction_amt: return_amt,
                client_transaction_amt: return_amt
            })
            transModel.saveTransaction(transData, (err, savedData) => {
                console.log('jobSeeker in events savedData', err, savedData);

                if (err) {
                    return res.status(200).json({
                        title: 'Something went wrong, Please try again..',
                        error: true,
                    });
                }
                return res.status(200).json({
                    title: 'Service cancelled successfully',
                    error: false,
                    data: savedData
                });
            })
        })
    })
}

/*
# parameters: token,
# purpose: cron for reminder one day prior service
*/
const serviceReminder = async () => {
    var current_date = new Date()

    var next_date = new Date(current_date.setDate(current_date.getDate() + 1))

    console.log('cancelServiceRequest current_date ', current_date, next_date);

    var start = moment.tz(next_date, helper.getTimezone()).startOf('day').toDate()
    var end = moment.tz(next_date, helper.getTimezone()).endOf('day').toDate()

    console.log('cancelServiceRequest start ', start, end);

    let serviceData = await requestModel.getRequestByQuery({ service_status: "Scheduled", service_time: { $gte: start, $lte: end } });
    console.log('cancelServiceRequest serviceData ', serviceData.length);

    async.eachOfSeries(serviceData, function (request, key, cb) {
        var serviceTime = moment.tz(request.service_time, helper.getTimezone()).format('MMM DD, YYYY hh:mm a') //MMM DD, YYYY //YYYY-MM-DD
        console.log('acceptDenyRequest time--', serviceTime);

        //to consumer
        var msgSub = 'Your service request ' + request.service_id.name + ' by: ' + request.astrologer_id.first_name + ' has been scheduled at: ' + serviceTime

        let consData = {
            msg: msgSub,
            title: "",
            device_token: request.consumer_id.device_token,
            data: {
                message: msgSub,
                flag: "Service Reminder",
            }
        }
        consData.data.user_id = request.consumer_id._id
        consData.data.sec_user_id = request.astrologer_id._id
        notificationController.sendNotification(consData)

        //sent mail to consumer
        let msgBody = msgSub
        let mailData = {
            email: request.consumer_id.email,
            subject: 'Service Reminder',
            body:
                '<p>' + msgBody
        };
        helper.sendEmail(mailData)

        //sms to consumer
        var smsData = {}
        smsData.to = ['91' + serviceData.consumer_id.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828922807065"
        smsData.message = msgSub
        //    let sms = helper.sendSMS(smsData)

        //to astrologer
        var msg = "Reminder! " + request.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + " for " + request.service_id.name + ". They follow all safety and precautionary measures."
        let astrologerData = {
            msg: msg,
            title: "",
            device_token: request.astrologer_id.device_token,
            data: {
                message: msg,
                flag: "Service Reminder",
            }
        }
        astrologerData.data.user_id = request.astrologer_id._id
        astrologerData.data.sec_user_id = request.consumer_id._id
        notificationController.sendNotification(consData)

        //send mail to astrologer
        var astrologerMsg = msg
        let mailAstrologer = {
            email: request.astrologer_id.email,
            subject: 'AstroWize - Service Reminder!',
            body:
                "<p>" +
                "Hello " + request.astrologer_id.first_name + "," +
                "<p>" +
                request.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + " for " + request.service_id.name + ". They follow all safety and precautionary measures. Thank you for using our services" +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailAstrologer);

        cb()
    }, function (err) {
        console.log('consumer done--------', err);
    })
}

/*
# parameters: token,
# purpose: pay service request from payment link
*/
const payFromPaymentLink = async (req, res) => {
    console.log('payFromPaymentLink req.body', req.body)
    console.log('payFromPaymentLink req.user---', req.user)

    const result = validationResult(req);

    console.log('payFromPaymentLink errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await requestModel.getRequestById(req.body);
    console.log('payFromPaymentLink serviceData ', serviceData);

    if (!serviceData) {
        return res.status(200).json({
            title: 'No service found',
            error: true,
        });
    }

    var res_title = "Service scheduled succesfully"

    let use_wallet = false;
    let wallet_amt_used = 0;
    async.waterfall([
        function (firstCallback) {
            //check if user selected wallet option            
            var payAmount = serviceData.remain_amt

            if (req.body.is_wallet && (req.body.is_wallet == true || req.body.is_wallet == 'true') && req.user.wallet_balance > 0) {
                var transAmount = 0

                var pendingAmt = req.user.wallet_balance - serviceData.remain_amt
                if (pendingAmt >= 0) {
                    req.user.wallet_balance = parseFloat(req.user.wallet_balance - serviceData.remain_amt).toFixed(2)
                    transAmount = parseFloat(serviceData.remain_amt).toFixed(2)
                    payAmount = 0

                    serviceData.service_status = "Scheduled"
                }
                else {
                    transAmount = parseFloat(req.user.wallet_balance).toFixed(2)
                    payAmount = parseFloat(serviceData.remain_amt - req.user.wallet_balance).toFixed(2)
                    //    req.user.wallet_balance = 0
                    wallet_amt_used = req.user.wallet_balance
                    use_wallet = true
                }

                console.log('payFromPaymentLink firstCallback transAmount ', transAmount, payAmount);

                //    serviceData.remain_amt = undefined
                serviceData.save((error, savedRequest) => {
                    console.log('payFromPaymentLink else---', error, savedRequest)

                    if (error) {
                        return firstCallback(null, true, undefined);
                    }
                    if (pendingAmt >= 0) {
                        //to save transaction
                        var transData = new transModel({
                            transaction_type: 'service',
                            consumer_id: req.user._id,
                            astrologer_id: serviceData.astrologer_id._id,
                            service_req_id: serviceData._id,
                            payment_status: "success",
                            payment_type: "wallet",
                            pay_type: "second",
                            transaction_amt: transAmount,
                            client_transaction_amt: transAmount
                        })
                        transModel.saveTransaction(transData, (err, savedData) => {
                            console.log('payFromPaymentLink wallet savedData', err, savedData);

                            if (err) {
                                return firstCallback(null, true, undefined);
                            }
                            req.user.save((error, savedUser) => {
                                console.log('payFromPaymentLink savedTrans---', error, savedUser)

                                if (error) {
                                    return firstCallback(null, true, undefined);
                                }

                                return firstCallback(null, false, payAmount);
                            })
                        })
                    }
                    else {
                        console.log('payFromPaymentLink CHECK 5.2');
                        req.user.save((error, savedUser) => {
                            console.log('payFromPaymentLink savedTrans---', error, savedUser)

                            if (error) {
                                return firstCallback(null, true, undefined);
                            }

                            return firstCallback(null, false, payAmount);
                        })
                    }
                })
            }
            else {
                console.log('payFromPaymentLink firstCallback else');
                return firstCallback(null, false, payAmount);
            }
        },
        function (err, payAmount, secCallback) {
            console.log('payFromPaymentLink secCallback payAmount---', err, payAmount)

            if (err) {
                return secCallback(error, true)
            }
            if (payAmount > 1) {
                res_title = "Please pay the amount to sent request."

                //razor pay
                var product_number = randomstring.generate(7);
                var instance = new Razorpay({ key_id: process.env.razor_key_id, key_secret: process.env.razor_key_secret })
                var options = {
                    amount: parseFloat(payAmount).toFixed(2) * 100,  // amount in the smallest currency unit
                    currency: "INR",
                    receipt: product_number,
                    notes: {
                        order_type: 'service_accept',
                        use_wallet: use_wallet,
                        wallet_amt_used: wallet_amt_used
                    }
                };
                instance.orders.create(options, function (err, order) {
                    console.log('payFromPaymentLink razor instance err', err);
                    if (err) {
                        return secCallback(err, true)
                    }

                    console.log('payFromPaymentLink razor instance order', order);

                    serviceData.partial_order_id = order.id
                    serviceData.partial_receipt = order.receipt
                    serviceData.payment_status = 'pending'
                    //    serviceData.remain_amt = undefined

                    serviceData.save((error, savedRequest) => {
                        console.log('payFromPaymentLink error---', error)

                        if (error) {
                            return secCallback(error, true)
                        }

                        var data = new Object();
                        data = savedRequest.toObject({ getters: true })
                        data.payAmount = parseFloat(payAmount).toFixed(2)
                        return secCallback(null, data)
                    })
                })
            } else {
                serviceData.payment_status = 'success'

                serviceData.save((error, savedRequest) => {
                    console.log('payFromPaymentLink else---', error, savedRequest)

                    if (error) {
                        return secCallback(error, true)
                    }
                    if (payAmount == 0 && req.body.request_id) {
                        requestModel.findOne({ _id: req.body.request_id })
                            .populate('consumer_id')
                            .populate('astrologer_id')
                            .populate('service_id')
                            .then(result => {
                                let serviceTime = moment.tz(result.service_time, helper.getTimezone()).format('MMM DD, YYYY hh:mm a')
                                //send mail to astrologer
                                let astrologerMsg = "Seva ka waqt! You have received a service request. Click here to know more."
                                let mailAstrologer = {
                                    email: result.astrologer_id.email,
                                    subject: 'Service request assigned',
                                    body:
                                        "<p>" +
                                        "Hello " + result.astrologer_id.first_name + "," +
                                        "<p>" +
                                        "A service request for " + result.service_id.name + " has been assigned to you at " + result.consumer_id.first_name + "'s place at " + serviceTime + ". To accept, head over to Astrowize app. Thank you." +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };  //'<p>' + astrologerMsg
                                helper.sendEmail(mailAstrologer);

                                //to astrologer
                                let astrologerData = {//
                                    msg: astrologerMsg,
                                    title: "",
                                    device_token: result.astrologer_id.device_token,
                                    data: {
                                        message: astrologerMsg,
                                        flag: "Service Scheduled",
                                        targetedScreen: "service_list"
                                    }
                                }
                                astrologerData.data.user_id = result.astrologer_id._id
                                astrologerData.data.sec_user_id = result.consumer_id._id
                                notificationController.sendNotification(astrologerData)

                                mail_sub = "Service Scheduled"
                                push_flag = "Service Scheduled"

                                //sms to astrologer
                                var smsData = {}
                                smsData.to = ['91' + result.astrologer_id.mobile.replace(/\D/g, '')]
                                smsData.template_id = "1707160828912009816"
                                smsData.message = "Hello " + result.astrologer_id.first_name + ",\nA service request for " + result.service_id.name + " has been assigned to you at " + result.consumer_id.first_name + "'s place at " + serviceTime + ". To accept, head over to AstroWize app. Thanks, FINOTO."
                                let sms = helper.sendSMS(smsData)
                            })
                    }
                    var data = new Object();
                    data = savedRequest.toObject({ getters: true })
                    data.payAmount = parseFloat(payAmount).toFixed(2)
                    return secCallback(null, data)
                })
            }
        }
    ], function (err, savedRequest) {
        console.log('payFromPaymentLink funtion err -- ', err)
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }
        return res.status(200).json({
            title: res_title,
            error: false,
            data: savedRequest
        });
    })
}

/*
# parameters: token,
# purpose: complete service request by astrologer by adding otp
*/
const completeRequest = async (req, res) => {
    console.log('completeRequest req.body', req.body)
    console.log('completeRequest req.user---', req.user)

    const result = validationResult(req);

    console.log('completeRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await requestModel.getRequestById(req.body);
    console.log('completeRequest serviceData ', serviceData);

    if (serviceData.otp != req.body.request_otp) {
        return res.status(200).json({
            title: 'Wrong otp entered',
            error: true,
        });
    }

    serviceData.service_status = "Completed"

    serviceData.save((error, savedRequest) => {
        console.log('completeRequest savedRequest---', error, savedRequest)
        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again',
                error: true,
            });
        }

        //to consumer
        let consData = serviceData.consumer_id
        var msg = "Swaha! Your service for " + serviceData.service_id.name + " has been completed successfully. Have a healthy and happy life!"
        let consumerData = {
            msg: msg,
            title: "",
            device_token: consData.device_token,
            data: {
                message: msg,
                flag: "Service Completed",
                targetedScreen: "service_list",
                request_id: serviceData._id
            }
        }
        consumerData.data.user_id = consData._id
        notificationController.sendNotification(consumerData)

        //sent mail to consumer
        let mailData = {
            email: consData.email,
            subject: 'AstroWize - Service completed successfully!',
            body:
                "<p>" +
                "Hello " + serviceData.consumer_id.first_name + "," +
                "<p>" +
                "Your service for " + serviceData.service_id.name + " has been completed successfully." +
                "Have a healthy and happy life! Explore more of our services only on Astrowize app. " +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData)

        //sms to consumer
        var smsData = {}
        smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828963221262"
        smsData.message = "Hello " + consData.first_name + ",\n  Your service for " + serviceData.service_id.name + " has been completed successfully. Have a healthy and happy life!. Thanks, FINOTO."
        let smsConsumer = helper.sendSMS(smsData)

        return res.status(200).json({
            title: "Service completed successfully",
            error: false,
            data: savedRequest
        });
    })
}

/*
# parameters: token, request_id
# purpose: send otp to consumer to verify service is completed
*/
const sendCompleteOtp = async (req, res) => {

    console.log('sendCompleteOtp req.body', req.body)

    const result = validationResult(req);

    console.log('sendCompleteOtp errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await requestModel.getRequestById(req.body);

    // OTP for completing service
    var otp = randomstring.generate({
        length: 4,
        charset: 'numeric'
    });

    console.log('OTP', otp);

    serviceData.otp = otp
    serviceData.save((error, savedReq) => {
        if (error) {
            return res.status(400).json({
                error: true,
                title: 'Failure'
            })
        }
        else {

            // Send OTP email to consumer
            let mailConsumer = {
                email: serviceData.consumer_id.email,
                subject: 'AstroWize - Service completion OTP!',
                body:
                    "<p>" +
                    "Hello," +
                    "<p>" +
                    "Please enter the OTP " + otp + " to confirm the completion of your  " + serviceData.service_id.name + " service." +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailConsumer);

            //to consumer
            let consData = serviceData.consumer_id
            var msg = "Please enter the OTP " + otp + " to confirm the completion of your " + serviceData.service_id.name + " service."
            let consumerData = {
                msg: msg,
                title: "",
                device_token: consData.device_token,
                data: {
                    message: msg,
                    flag: "Service OTP",
                    targetedScreen: "service_list",
                    request_id: serviceData._id
                }
            }
            consumerData.data.user_id = consData._id
            notificationController.sendNotification(consumerData)

            // Send OTP sms to consumer 
            let smsData = {}
            smsData.to = ['91' + serviceData.consumer_id.mobile.replace(/\D/g, '')]
            smsData.template_id = "1707160828971247358"
            smsData.message = "Hello " + serviceData.consumer_id.first_name + ",\n Please enter the OTP " + otp + " to confirm the completion of your  " + serviceData.service_id.name + " service. Thanks, FINOTO."
            let sms = helper.sendSMS(smsData)

            return res.status(200).json({
                error: false,
                title: 'Service Completion OTP sent successfully'
            })
        }
    })

}

const notifyServicePayment = async (req, msgTemp) => {

    let serviceData = await requestModel.getRequestById(req.body);

    if (serviceData.payment_status == 'pending') {

        // SEND EMAIL
        let mailConsumer = {
            email: serviceData.consumer_id.email,
            subject: 'AstroWize - Service request confirmed!',
            body:
                '<p>' +
                'Hello ' + serviceData.consumer_id.first_name + ',' +
                '<p>' +
                msgTemp.consumerMailMsg +
                '<p>' +
                'Regards,' +
                '<br>' +
                'Team AstroWize'
        };

        helper.sendEmail(mailConsumer);

        // SEND NOTIFICATION
        let consumerData = {
            msg: msgTemp.consumerMsg,
            title: '',
            device_token: serviceData.consumer_id.device_token,
            data: {
                message: msgTemp.consumerMsg,
                flag: 'Service Accepted',
                request_id: serviceData._id,
                targetedScreen: 'service_list'
            }
        }

        consumerData.data.sec_user_id = serviceData.astrologer_id._id
        consumerData.data.user_id = serviceData.consumer_id._id
        notificationController.sendNotification(consumerData)

        // SEND SMS
        var smsConsumerData = {}
        smsConsumerData.to = ['91' + serviceData.consumer_id.mobile.replace(/\D/g, '')]
        smsConsumerData.template_id = msgTemp.template_id
        smsConsumerData.message = 'Hello ' + serviceData.consumer_id.first_name + ',\n' + msgTemp.consumerSmsMsg
        let smsConsumer = helper.sendSMS(smsConsumerData)

    }

}

const cancelServiceReqScheduler = async (req) => {

    let serviceData = await requestModel.getRequestById(req.body);

    if (serviceData.payment_status == 'pending' && serviceData.service_status != 'Cancelled' && serviceData.service_status != 'Completed') {

        serviceData.service_status = 'Cancelled';

        serviceData.save((error, savedRequest) => {
            if (error) {
                console.log('cancelServiceReqScheduler savedRequest---', error, savedRequest)
            }

            // REFUND TO WALLET
            let refund_amt = parseFloat(serviceData.rate) - parseFloat(serviceData.remain_amt);
            let wallet_balance = parseFloat(serviceData.consumer_id.wallet_balance + refund_amt).toFixed(2)

            let consData = serviceData.consumer_id;
            consData.wallet_balance = wallet_balance;

            consData.save((error, savedUser) => {
                if (error) {
                    console.log('cancelServiceReqScheduler savedUser---', error, savedUser)
                }

                let msg = "Uh-oh! Your service request for " + serviceData.service_id.name + " has been cancelled and ₹ " + parseFloat(refund_amt).toFixed(2) + " has been restored in your Astrowize wallet."

                // SEND EMAIL
                let mailData = {
                    email: consData.email,
                    subject: 'AstroWize - Service request cancelled!',
                    body:
                        "<p>" +
                        "Hello " + consData.first_name + "," +
                        "<p>" +
                        "Your service request for " + serviceData.service_id.name + " has been cancelled and ₹ " + parseFloat(refund_amt).toFixed(2) + " has been restored in your Astrowize wallet." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)

                // SEND NOTIFICATION
                let consumerData = {
                    msg: msg,
                    title: '',
                    device_token: consData.device_token,
                    data: {
                        message: msg,
                        flag: 'Service Cancelled',
                        request_id: serviceData._id,
                        targetedScreen: 'service_list'
                    }
                }

                consumerData.data.user_id = consData._id
                notificationController.sendNotification(consumerData)

                // SAVE TRANSACTION
                let transData = new transModel({
                    transaction_type: 'service',
                    consumer_id: consData._id,
                    service_req_id: savedRequest._id,
                    payment_status: 'success',
                    payment_type: 'wallet',
                    pay_type: 'refund',
                    transaction_amt: refund_amt,
                    client_transaction_amt: refund_amt
                })

                transModel.saveTransaction(transData, (err, savedData) => {
                    if (err) {
                        console.log('cancelServiceReqScheduler jobSeeker in events savedData', err, savedData);
                    }
                })
            })
        })

    }
}

/*
# parameters: token, request_id
# purpose: send otp to consumer to verify service is started
*/
const sendServiceStartedOtp = async (req, res) => {

    console.log('sendServiceStartedOtp req.body', req.body)

    const result = validationResult(req);

    console.log('sendServiceStartedOtp errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await requestModel.getRequestById(req.body);

    // OTP for completing service
    var otp = randomstring.generate({
        length: 4,
        charset: 'numeric'
    });

    console.log('OTP', otp);

    serviceData.otp = otp
    serviceData.save((error, savedReq) => {
        if (error) {
            return res.status(400).json({
                error: true,
                title: 'Failure'
            })
        }
        else {

            // OTP EMAIL - TO CONSUMER
            let mailConsumer = {
                email: serviceData.consumer_id.email,
                subject: 'AstroWize - Service start OTP!',
                body:
                    "<p>" +
                    "Hello," +
                    "<p>" +
                    "Please enter the OTP " + otp + " to confirm the start of your  " + serviceData.service_id.name + " service." +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailConsumer);

            // OTP NOTIFICATION - TO CONSUMER
            let consData = serviceData.consumer_id
            var msg = "Please enter the OTP " + otp + " to confirm the start of your " + serviceData.service_id.name + " service."
            let consumerData = {
                msg: msg,
                title: "",
                device_token: consData.device_token,
                data: {
                    message: msg,
                    flag: "Service OTP",
                    targetedScreen: "service_list",
                    request_id: serviceData._id
                }
            }
            consumerData.data.user_id = consData._id
            notificationController.sendNotification(consumerData)

            // OTP SMS - TO CONSUMER
            let smsData = {}
            smsData.to = ['91' + serviceData.consumer_id.mobile.replace(/\D/g, '')]
            smsData.template_id = "1707162005834394065"
            smsData.message = "Hello " + serviceData.consumer_id.first_name + ", Please enter the OTP " + otp + " to confirm the start of your " + serviceData.service_id.name + " service. Thanks, FINOTO."
            let sms = helper.sendSMS(smsData)

            return res.status(200).json({
                error: false,
                title: 'Start service otp sent successfully'
            })
        }
    })

}

/*
# parameters: token, request_id, request_otp
# purpose: mark service request started by astrologer by adding otp
*/
const markServiceStarted = async (req, res) => {
    console.log('markServiceStarted req.body', req.body)
    console.log('markServiceStarted req.user---', req.user)

    const result = validationResult(req);

    console.log('markServiceStarted errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await requestModel.getRequestById(req.body);
    console.log('markServiceStarted serviceData ', serviceData);

    if (serviceData.otp != req.body.request_otp) {
        return res.status(200).json({
            title: 'Wrong otp entered',
            error: true,
        });
    }

    serviceData.service_status = "Started"

    serviceData.save((error, savedRequest) => {
        console.log('markServiceStarted savedRequest---', error, savedRequest)
        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again',
                error: true,
            });
        }

        // NOTIFICATION - TO CONSUMER
        let consData = serviceData.consumer_id
        var msg = "Swaha! Your service for " + serviceData.service_id.name + " has been started."
        let consumerData = {
            msg: msg,
            title: "",
            device_token: consData.device_token,
            data: {
                message: msg,
                flag: "Service Started",
                targetedScreen: "service_list",
                request_id: serviceData._id
            }
        }
        consumerData.data.user_id = consData._id
        notificationController.sendNotification(consumerData)

        // EMAIL - TO CONSUMER
        let mailData = {
            email: consData.email,
            subject: 'AstroWize - Service started!',
            body:
                "<p>" +
                "Hello " + serviceData.consumer_id.first_name + "," +
                "<p>" +
                "Your service for " + serviceData.service_id.name + " has been started." +
                "Have a healthy and happy life! Explore more of our services only on Astrowize app." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData)

        // SMS - TO CONSUMER
        var smsData = {}
        smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828963221262"
        smsData.message = "Hello " + consData.first_name + ",\n  Your service for " + serviceData.service_id.name + " has been started. Thanks, FINOTO."
        let smsConsumer = helper.sendSMS(smsData)

        return res.status(200).json({
            title: "Service started successfully",
            error: false,
            data: savedRequest
        });
    })
}

const markServiceCompleted = async (req, res) => {

    let serviceReqList = await requestModel.getRequestByQuery({ service_status: 'Started' });

    async.eachOfSeries(serviceReqList, (serviceData, key, cb) => {

        console.log('\n\nMarkServiceCompleted :-', serviceData.service_status);

        serviceData.service_status = 'Completed'
        serviceData.save((error, savedRequest) => {

            console.log('ERROR :-', error);
            console.log('SAVED :-');

            // NOTIFICATION - TO CONSUMER
            let consData = serviceData.consumer_id
            var msg = "Swaha! Your service for " + serviceData.service_id.name + " has been completed successfully. Have a healthy and happy life!"
            let consumerData = {
                msg: msg,
                title: "",
                device_token: consData.device_token,
                data: {
                    message: msg,
                    flag: "Service Completed",
                    targetedScreen: "service_list",
                    request_id: serviceData._id
                }
            }
            consumerData.data.user_id = consData._id
            notificationController.sendNotification(consumerData)

            // EMAIL - TO CONSUMER
            let mailData = {
                email: consData.email,
                subject: 'AstroWize - Service completed successfully!',
                body:
                    "<p>" +
                    "Hello " + serviceData.consumer_id.first_name + "," +
                    "<p>" +
                    "Your service for " + serviceData.service_id.name + " has been completed successfully." +
                    "Have a healthy and happy life! Explore more of our services only on Astrowize app. " +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData)

            // SMS - TO CONSUMER
            var smsData = {}
            smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
            smsData.template_id = "1707160828963221262"
            smsData.message = "Hello " + consData.first_name + ",\n  Your service for " + serviceData.service_id.name + " has been completed successfully. Have a healthy and happy life!. Thanks, FINOTO."
            let smsConsumer = helper.sendSMS(smsData)

            cb()
        })

    }, (err) => {
        console.log('\n\nMarkServiceCompleted', err);
    })

    //service auto cancel
    var current_date = new Date()

    var prev_date = new Date(current_date.setDate(current_date.getDate() - 1))

    console.log('nMarkServiceCompleted current_date ', current_date, prev_date);

    var start = moment.tz(prev_date, helper.getTimezone()).startOf('day').toDate()
    var end = moment.tz(prev_date, helper.getTimezone()).endOf('day').toDate()

    console.log('nMarkServiceCompleted start ', start, end);

    let serviceList = await requestModel.getRequestByQuery({ service_status: "Scheduled", service_time: { $gte: start, $lte: end } });
    console.log('cancelServiceRequest serviceList ');
    
    async.eachOfSeries(serviceList, (serviceData, key, cb) => {

        console.log('\n\nMarkServiceCompleted :-', serviceData.service_status);

        serviceData.service_status = 'Cancelled'
        serviceData.save((error, savedRequest) => {

            console.log('nMarkServiceCompleted cancell :-', error);
            console.log('nMarkServiceCompleted cancell :-');

            var return_amt = serviceData.rate

            console.log('nMarkServiceCompleted wallet_balance before---', serviceData.consumer_id.wallet_balance)
            let wallet_balance = parseFloat(serviceData.consumer_id.wallet_balance + return_amt).toFixed(2)
            console.log('nMarkServiceCompleted wallet_balance---', serviceData.consumer_id.wallet_balance, '---', wallet_balance)

            let consData = serviceData.consumer_id
            consData.wallet_balance = wallet_balance

            consData.save((error, savedUser) => {
                console.log('nMarkServiceCompleted savedUser---', error, savedUser)

                if (error) {
                    
                }

                // send mail to astrologer
                let mailAstrologer = {
                    email: serviceData.astrologer_id.email,
                    subject: 'AstroWize - Service request cancelled!',
                    body:
                        "<p>" +
                        "Hello " + serviceData.astrologer_id.first_name + "," +
                        "<p>" +
                        "The " + serviceData.service_id.name + " assigned to you has been cancelled. Visit the app to know why." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailAstrologer);

                //to astrologer
                var astrologerMsg = "Out of service! The service assigned to you was cancelled. Click here to know why."
                let astrologerData = {
                    msg: astrologerMsg,
                    title: "",
                    device_token: serviceData.astrologer_id.device_token,
                    data: {
                        message: astrologerMsg,
                        flag: "Service Cancelled",
                        targetedScreen: "service_list"
                    }
                }
                astrologerData.data.user_id = serviceData.astrologer_id._id
                astrologerData.data.sec_user_id = serviceData.consumer_id._id

                notificationController.sendNotification(astrologerData)

                //sms to astrologer
                var smsData = {}
                smsData.to = ['91' + serviceData.astrologer_id.mobile.replace(/\D/g, '')]
                smsData.template_id = "1707160829020038554"
                smsData.message = "Hello " + serviceData.astrologer_id.first_name + ",\n\nThe " + serviceData.service_id.name + " assigned to you has been cancelled. Visit the app to know why. Thanks, FINOTO."
                let sms = helper.sendSMS(smsData)

                //to consumer
                var msg = "Uh-oh! Your service request for " + serviceData.service_id.name + " has been cancelled and ₹ " + parseFloat(return_amt).toFixed(2) + " has been restored in your Astrowize wallet."
                let consumerData = {
                    msg: msg,
                    title: "",
                    device_token: consData.device_token,
                    data: {
                        message: msg,
                        flag: "Service Cancelled",
                        request_id: serviceData._id,
                        targetedScreen: "service_list"
                    }
                }
                consumerData.data.user_id = consData._id
                notificationController.sendNotification(consumerData)

                //sent mail to consumer
                let mailData = {
                    email: consData.email,
                    subject: 'AstroWize - Service request cancelled!',
                    body:
                        "<p>" +
                        "Hello " + consData.first_name + "," +
                        "<p>" +
                        "Your service request for " + serviceData.service_id.name + " has been cancelled and ₹ " + parseFloat(return_amt).toFixed(2) + " has been restored in your Astrowize wallet." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)

                //to save transaction
                var transData = new transModel({
                    transaction_type: 'service',
                    consumer_id: consData._id,
                    service_req_id: savedRequest._id,
                    payment_status: "success",
                    payment_type: "wallet",
                    pay_type: "refund",
                    transaction_amt: return_amt,
                    client_transaction_amt: return_amt
                })
                transModel.saveTransaction(transData, (err, savedData) => {
                    console.log('jobSeeker in events savedData', err, savedData);

                    if (err) {
                        
                    }
                    cb()
                })
            })
        })

    }, (err) => {
        console.log('\n\nMarkServiceCompleted cancell', err);
    })
}

module.exports = {
    requestService,
    acceptDenyRequest,
    serviceRequestListing,
    serviceRequestDetails,
    cancelServiceRequest,
    serviceReminder,
    payFromPaymentLink,
    completeRequest,
    sendCompleteOtp,
    notifyServicePayment,
    cancelServiceReqScheduler,
    sendServiceStartedOtp,
    markServiceStarted,
    markServiceCompleted
}  