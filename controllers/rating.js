/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
const nodeGeocoder = require('node-geocoder');
const Razorpay = require('razorpay')

/* Models */
const ratingModel = require('../models/rating');
const transModel = require('../models/transaction');
const userModel = require('../models/user');
const calldetailModel = require('../models/calldetail');
const requestModel = require('../models/serviceRequest')

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

/*
# parameters: token, rating, description
# purpose: add rating by consumer
*/
const addRating = async (req, res) => {
    console.log('addRating req.body', req.body)
    console.log('addRating req.user', req.user)

    const result = validationResult(req);
    console.log('addRating errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let astrologer = await userModel.getUserFromQuery({ _id: req.body.to_id });
    console.log('addRating astrologer ', astrologer);
    if (!astrologer) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    var newRating = new ratingModel({
        from_id: req.user._id,
        to_id: req.body.to_id,
        description: req.body.description,
        rating_value: parseFloat(req.body.rating_value)
    })

    var res_title = "Review submitted successfully"
    if (parseFloat(req.body.rating_value) == 0) {
        res_title = "Guru dakshina sent successfully"
    }

    var astrologerMsg = 'Review Alert! A customer has reviewed your services on our app. Check it out now!'
    var smsMsg = 'A customer has reviewed your services on our app. Head over to AstroWize app to view the same. Thanks, FINOTO.'
    var template_id_astrologer = "1707160829063579188"
    var astrologerMailSub = 'New review received on Astrowize'
    var astrologerMail = 'A customer has reviewed your services on our app. Head over to Astrowize app to view the same. Thank you.'
    var consumerMsg = "Thank you! Your review of " + parseInt(req.body.rating_value) + " stars was submitted successfully to " + astrologer.first_name
    var consumerMailMsg = "Your review of " + parseInt(req.body.rating_value) + " stars was submitted successfully to " + astrologer.first_name + ". Thank you for your review. "
    var flag = 'Review Added'
    var smsConsumerMsg = ""
    var template_id_consumer = ""
    let targetedScreen = ''

    var added_rating = null

    let use_wallet = false;
    let wallet_amt_used = 0;

    var serviceData = null

    async.waterfall([
        function (firstCallback) {
            (async () => {
                if (req.body.chat_id && req.body.chat_id != "") {
                    newRating.chat_id = req.body.chat_id
                    newRating.rating_type = "chat"
    
                    let rating = await ratingModel.getRatingByQuery({ chat_id: req.body.chat_id });
                    if (rating) {
                        return firstCallback(null, false, -99);//return [null, false, -99]; // firstCallback(null, false, -99);
                    }
                    return firstCallback(null, false, 0);//return [null, false, 0]; // firstCallback(null, false, 0);
                }
                if (req.body.call_id && req.body.call_id != "") {
                    newRating.call_id = req.body.call_id
    
                    let rating = await ratingModel.getRatingByQuery({ call_id: req.body.call_id });
                    console.log('addRating rating call_id ', rating);
    
                    if (rating) {
                        return firstCallback(null, false, -99);//return [null, false, -99]; //firstCallback(null, false, -99);
                    }
                    let call = await calldetailModel.getCallByQuery({ _id: req.body.call_id })
                    console.log('addRating call call_id ', call);
    
                    if (call && call.call_audio_video == "video") {
                        newRating.rating_type = "video"
                        targetedScreen = 'video_history'
                    }
                    else if (call && call.call_audio_video == "audio") {
                        newRating.rating_type = "audio"
                        targetedScreen = 'audio_history'
                    }
                    else {
                        return firstCallback(null, false, -99);//return [null, false, -99]; //firstCallback(null, false, -99);
                    }
                    return firstCallback(null, false, 0);//return [null, false, 0]; //firstCallback(null, false, 0);
                }
                if (req.body.report_id && req.body.report_id != "") {
                    newRating.report_id = req.body.report_id
                    newRating.rating_type = "report"
    
                    let rating = await ratingModel.getRatingByQuery({ report_id: req.body.report_id });
                    if (rating) {
                        return firstCallback(null, false, -99);//return [null, false, -99]; //firstCallback(null, false, -99);
                    }
    
                    return firstCallback(null, false, 0);//return [null, false, 0]; //firstCallback(null, false, 0);
                }
                if (req.body.service_req_id && req.body.service_req_id != "") {
                    newRating.service_req_id = req.body.service_req_id
                    newRating.rating_type = "service"
                    targetedScreen = 'service_history'
    
                    let rating = await ratingModel.getRatingByQuery({ service_req_id: req.body.service_req_id });
                    console.log('addRating service_req_id rating ', rating)                
    
                    req.body.request_id = req.body.service_req_id
                    let servicedata = await requestModel.getRequestById(req.body);
                    console.log('addRating service_req_id servicedata ', servicedata)  
                    serviceData = servicedata
                    if (rating) {
                        added_rating = rating
                    }

                    if (req.body.tip && req.body.tip != "" && parseFloat(req.body.tip) > 1) {
                        var payAmount = parseFloat(req.body.tip).toFixed(2)
    
                        console.log('addRating res_title out ', res_title)
                        if (parseFloat(req.body.rating_value) > 0) {
                            res_title = "Review and Guru Dakshina sent successfully"
                            console.log('addRating res_title', res_title)
                        }

                        if (req.body.is_wallet && (req.body.is_wallet == true || req.body.is_wallet == 'true') && req.user.wallet_balance > 0) {
                            var transAmount = 0
                            var pendingAmt = req.user.wallet_balance - parseFloat(req.body.tip)

                            if (pendingAmt >= 0) {
                                req.user.wallet_balance = parseFloat(req.user.wallet_balance - parseFloat(req.body.tip)).toFixed(2)
                                transAmount = parseFloat(req.body.tip).toFixed(2)
                                payAmount = 0
                            }
                            else {
                                transAmount = req.user.wallet_balance
                                payAmount = parseFloat(parseFloat(req.body.tip) - req.user.wallet_balance).toFixed(2)
                            //    req.user.wallet_balance = 0

                                wallet_amt_used = req.user.wallet_balance
                                use_wallet = true
                            }
    
                            console.log('addRating firstCallback transAmount ', transAmount, payAmount);
    
                            if (pendingAmt >= 0) {
                                requestModel
                                .findOneAndUpdate({ '_id': req.body.service_req_id },
                                    { $set: { "tip": transAmount } }, { new: true, useFindAndModify: false })
                                .exec((err, data) => {
                                    console.log('addRating findOneAndUpdate err ', err);
                                    console.log('addRating findOneAndUpdate data ', data);
                                })
                                //to save transaction
                                var transData = new transModel({
                                    transaction_type: 'tip',
                                    consumer_id: req.user._id,
                                    astrologer_id: req.body.to_id,
                                    service_req_id: req.body.service_req_id,
                                    payment_status: "success",
                                    payment_type: "wallet",
                                    transaction_amt: transAmount,
                                    client_transaction_amt: transAmount
                                })
                                transModel.saveTransaction(transData, (err, savedData) => {
                                    console.log('addRating wallet savedData', err, savedData);
        
                                    if (err) {
                                        firstCallback(null, true, -99);//return [null, true, -99]; //firstCallback(null, true, undefined);
                                    }
                                    req.user.save((error, savedUser) => {
                                        console.log('addRating savedTrans---', error, savedUser)
        
                                        if (error) {
                                            return firstCallback(null, true, -99);//return [null, true, -99]; //firstCallback(null, true, undefined);
                                        }
        
                                        //send mail to astrologer
                                        astrologerMsg = 'Tip of the day! A generous consumer has paid you a tip above your fees! Click here to know who. '
                                        smsMsg = 'A generous consumer has paid a tip above your fees. Head over to AstroWize app to know who it is. Thank you for your valuable services, FINOTO.'
                                        template_id_astrologer = "1707160829053262924"
                                        astrologerMail = 'A generous consumer has paid a tip above your fees. Head over to Astrowize app to know who it is. Thank you for your valuable services.'
                                        astrologerMailSub = "Here's a TIP for you!"
        
                                        //to consumer                                    
                                        consumerMsg = "Guru Dakshina! This is to inform you that tip of ₹ " + transAmount + " was successfully paid to " + astrologer.first_name + " from your Astrowize wallet."
                                        consumerMailMsg = "This is to inform you that tip of  ₹ " + transAmount + " was successfully paid to " + astrologer.first_name + " from your Astrowize wallet."
                                        smsConsumerMsg = "This is to inform you that tip of  ₹ " + transAmount + " was successfully paid to " + astrologer.first_name + " from your AstroWize wallet. Thanks, FINOTO."
                                        template_id_consumer = "1707160828977833101"
                                        flag = "Guru Dakshina"

                                        console.log('addRating savedTrans parseFloat(req.body.rating_value ---', parseFloat(req.body.rating_value))

                                        if (parseFloat(req.body.rating_value) == 0) {
                                            return firstCallback(null, false, payAmount);
                                        }
                                        if (rating) {
                                            added_rating = rating
                                            return firstCallback(null, false, payAmount);//return [null, false, payAmount]; //firstCallback(null, false, 0);
                                        }
                                        
                                        newRating.save((error, savedRating) => {
                                            console.log('addRating else---', error, savedRating)
                
                                            if (error) {
                                                return firstCallback(null, true, -99);//return [null, true, -99];
                                            }
        
                                            return firstCallback(null, false, payAmount);//return [null, false, payAmount]; //firstCallback(null, false, payAmount);
                                        })
                                    })
                                })
                            }
                            else {
                                req.user.save((error, savedUser) => {
                                    console.log('addRating savedTrans else ---', error, savedUser)
    
                                    if (parseFloat(req.body.rating_value) == 0) {
                                        return firstCallback(null, false, payAmount);
                                    }
                                    if (rating) {
                                        added_rating = rating
                                        return firstCallback(null, false, payAmount);//return [null, false, payAmount]; //firstCallback(null, false, 0);
                                    }
                                    
                                    newRating.save((error, savedRating) => {
                                        console.log('addRating else else ---', error, savedRating)
            
                                        if (error) {
                                            return firstCallback(null, true, -99);//return [null, true, -99];
                                        }
    
                                        return firstCallback(null, false, payAmount);//return [null, false, payAmount]; //firstCallback(null, false, payAmount);
                                    })
                                })
                            }
                        }
                        else {
                            console.log('addRating firstCallback else no wallet');
                            return firstCallback(null, false, payAmount);//return [null, false, payAmount];//firstCallback(null, false, payAmount);
                        }
                    }
                    else {
                        console.log('addRating tip---');
                        return firstCallback(null, false, 0);//return [null, false, 0]; //firstCallback(null, false, 0);
                    }
                } else {
                    console.log('addRating no service ---');
                    return firstCallback(null, false, 0);//return [null, false, 0]; //firstCallback(null, false, 0);
                }
            })()
        },
        function (err, payAmount, secCallback) { //(err, payAmount, secCallback) {
            console.log('addRating secCallback payAmount---', err, payAmount, parseFloat(req.body.rating_value))

            if (err) {
                return secCallback(err, true)
            }

            if ((flag == 'Review Added' && parseFloat(req.body.rating_value) > 0) || (flag == "Guru Dakshina")) {
                //send mail to astrologer
                let mailAstrologer = {
                    email: astrologer.email,
                    subject: astrologerMailSub,
                    body:
                        "<p>" +
                        "Hello " + astrologer.first_name + "," +
                        "<p>" +
                        astrologerMail +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailAstrologer);

                //to astrologer
                let astrologerData = {
                    msg: astrologerMsg,
                    title: "",
                    device_token: astrologer.device_token,
                    data: {
                        targetedScreen: targetedScreen,
                        message: astrologerMsg,
                        flag: flag,
                    }
                }
                astrologerData.data.user_id = astrologer._id
                astrologerData.data.sec_user_id = req.user._id
                notificationController.sendNotification(astrologerData)

                //if tip, then send payment sms
                //    if (req.body.tip && req.body.tip != "" && parseFloat(req.body.tip).toFixed(2) > 1) {
                //sms to astrologer
                var smsData = {}
                smsData.to = ['91' + astrologer.mobile.replace(/\D/g, '')]
                smsData.template_id = template_id_astrologer
                smsData.message = "Hello " + astrologer.first_name + ",\n" + smsMsg

                let sms = helper.sendSMS(smsData)
                //    }

                //sms to consumer
                if (smsConsumerMsg != "") {
                    var smsData = {}
                    smsData.to = ['91' + req.user.mobile.replace(/\D/g, '')]
                    smsData.template_id = template_id_consumer
                    smsData.message = "Hello " + req.user.first_name + ",\n" + smsConsumerMsg
                    let sms = helper.sendSMS(smsData)
                }
                //to consumer
                let consData = req.user
                let consumerData = {
                    msg: consumerMsg,
                    title: "",
                    device_token: consData.device_token,
                    data: {
                        targetedScreen: targetedScreen,
                        message: consumerMsg,
                        flag: flag,
                        targetedScreen: "earning_list"
                    }
                }
                consumerData.data.user_id = consData._id
                consumerData.data.sec_user_id = astrologer._id
                notificationController.sendNotification(consumerData)

                //send mail to consumer
                let mailConsumer = {
                    email: consData.email,
                    subject: flag,
                    body:
                        "<p>" +
                        "Hello " + consData.first_name + "," +
                        "<p>" +
                        consumerMailMsg +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailConsumer);
            }            

            if (payAmount == -99) {
                console.log('addRating payAmount ---', payAmount)

                return secCallback(null, {})
            }
            else if (payAmount > 1) {
                console.log('addRating payAmount greater', payAmount)
                //razor pay
                var product_number = randomstring.generate(7);
                var instance = new Razorpay({ key_id: process.env.razor_key_id, key_secret: process.env.razor_key_secret })
                var options = {
                    amount: parseFloat(payAmount).toFixed(2) * 100,  // amount in the smallest currency unit
                    currency: "INR",
                    receipt: product_number,
                    notes: {
                        order_type: 'tip',
                        use_wallet: use_wallet,
                        wallet_amt_used: wallet_amt_used
                    }
                };
                instance.orders.create(options, function (err, order) {
                    console.log('addRating razor instance err', err);
                    if (err) {
                        return secCallback(err, true)
                    }

                    console.log('addRating razor instance order', order, added_rating);
                    
                    serviceData.pay_order_id = order.id
                    serviceData.pay_receipt = order.receipt

                    serviceData.save((error, savedReq) => {
                        console.log('addRating error---', error)

                        if (error) {
                            return secCallback(error, true)
                        }
                        
                        if (parseFloat(req.body.rating_value) > 0) {
                            if (added_rating) {
                                newRating = {}
                                newRating = added_rating
                            }
                            console.log('addRating razor instance after', added_rating);
        
                            newRating.pay_order_id = order.id
                            newRating.pay_receipt = order.receipt
        
                            newRating.save((error, savedRating) => {
                                console.log('addRating error---', error)
        
                                if (error) {
                                    secCallback(error, true)
                                }
        
                                var data = new Object();
                                data = savedRating.toObject({ getters: true })
                                data.payAmount = parseFloat(payAmount).toFixed(2)
        
                                return secCallback(null, data)
                            })
                        }
                        else {
                            console.log('addRating razor else payAmount', payAmount);

                            var data = new Object();
                            data = newRating.toObject({ getters: true })
                            data.pay_order_id = order.id
                            data.pay_receipt = order.receipt
                            data.payAmount = parseFloat(payAmount).toFixed(2)
        
                            return secCallback(null, data)
                        }
                    })
                })
            } else {
                console.log('addRating razor instance req.body.rating_value', req.body.rating_value);
                if (parseFloat(req.body.rating_value) == 0) {
                    return secCallback(null, {})
                }
                if (added_rating) {
                    newRating = {}
                    newRating = added_rating
                }

                console.log('addRating razor instance added_rating', added_rating);

                newRating.save((error, savedRating) => {
                    console.log('addRating payAmount less---', payAmount, savedRating)

                    if (error) {
                        return secCallback(error, true)
                    }

                    return secCallback(null, savedRating)
                })
            }
        }
    ], function (err, savedRating) {
        console.log('payFromPaymentLink funtion err -- ', err, savedRating)
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }
        return res.status(200).json({
            title: res_title,
            error: false,
            data: savedRating
        });
    })
}

module.exports = {
    addRating
}