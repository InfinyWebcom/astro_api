/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
const moment = require('moment')
const Razorpay = require('razorpay')

/* Models */
const settleModel = require('../models/settlement');
const transModel = require('../models/transaction');
const userModel = require('../models/user');

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

/*
# parameters: token,
# purpose: Create settlement
*/
const createSettlement = async (req, res) => {
    console.log('createSettlement req.user---', req.body)

    //user model
    var newSettle = new settleModel({
        title: req.body.title,
        astrologer_id: req.body.astrologer_id,
        remark: req.body.remark,
        transaction_ids: req.body.transaction_ids,
        payment_date: new Date(),
        transaction_amt: parseFloat(req.body.transaction_amt).toFixed(2)
    })

    let astrologer = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });
    console.log('createSettlement astrologer---', astrologer)

    if (!astrologer) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    newSettle.save((error, savedData) => {
        console.log('createSettlement error---', error)

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }

        transModel.updateMany({ _id: { $in: req.body.transaction_ids } }, { settlement_id: savedData._id })
            .exec((err, saveData) => {

                console.log('createSettlement err---', err, saveData)

                var settledTime = moment.tz(savedData.payment_date, helper.getTimezone()).format('MMM DD, YYYY hh:mm a')

                //send mail to astrologer
                let mailData = {
                    email: astrologer.email,
                    subject: 'AstroWize - Money Settled!',
                    body:
                        "<p>" +
                        "Hello " + astrologer.first_name + "," +
                        "<p>" +
                        "This is to inform you that Audio call/ Video call/Chat/ Report/ Service Request on " + settledTime + " for ₹" + parseFloat(req.body.transaction_amt).toFixed(2) + " has been settled successfully!" +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)

                //notification to astrologer
                var msg = "Good news! Your money has been settled by Admin. Check your AstroWize account balance to know more."
                let astroData = {
                    msg: msg,
                    title: "",
                    device_token: astrologer.device_token,
                    data: {
                        targetedScreen: 'my_earnings',
                        message: msg,
                        flag: "Transaction Settlement"
                    }
                }
                astroData.data.user_id = astrologer._id
                notificationController.sendNotification(astroData)

                //sms
                var smsData = {}
                smsData.to = ['91' + astrologer.mobile.replace(/\D/g, '')]
                smsData.template_id = "1707160828983480861"
                smsData.message = "Hello " + astrologer.first_name + ",\nYour money has been settled by Admin. You can check the balance on AstroWzie app. Thanks, FINOTO."
                let sms = helper.sendSMS(smsData)

                //to save transaction
                var transData = new transModel({
                    transaction_type: 'settlement',
                    payment_status: "success",
                    payment_type: "cash",
                    astrologer_id: req.body.astrologer_id,
                    transaction_amt: parseFloat(req.body.transaction_amt).toFixed(2),
                    client_transaction_amt: parseFloat(req.body.transaction_amt).toFixed(2),
                    settlement_id: savedData._id
                })
                transModel.saveTransaction(transData, (err, savedTrans) => {
                    console.log('jobSeeker in events savedTrans', err, savedTrans);

                    if (err) {
                        return res.status(200).json({
                            title: 'Something went wrong, Please try again..',
                            error: true,
                        });
                    }
                    return res.status(200).json({
                        title: 'Settlement saved successfully.',
                        error: false,
                        data: savedData
                    });
                })
            })
    })
}

/*
# parameters: token,
# purpose: get astrologers listing for settlement listing screen
*/
const getSettlementAstrologers = async (req, res) => {
    console.log('getSettlementAstrologers req.user---', req.body)

    let data = await settleModel.getOverallDetails(req);

    console.log('getSettlementAstrologers data ', data);

    if (data.length > 0) {
        return res.status(200).json({
            title: 'Settlements listing',
            error: false,
            data: data[0].data,
            total_count: data[0].totalCount
        });
    }

    return res.status(200).json({
        title: 'Astrologers listing',
        error: false,
        data: data
    });
}

/*
# parameters: token,
# purpose: get setllement listing for an astrologer
*/
const getSettlementsList = async (req, res) => {
    console.log('getSettlementsList req.user---', req.body)

    const result = validationResult(req);

    console.log('getSettlementsList errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let data = await settleModel.getSettlements(req);

    console.log('getSettlementsList data ', data);

    if (data.length > 0) {
        return res.status(200).json({
            title: 'Settlements listing',
            error: false,
            data: data[0].data,
            total_count: data[0].totalCount
        });
    }

    return res.status(200).json({
        title: 'Settlements listing',
        error: false,
        data: data
    });
}

/*
# purpose: CRON that runs weekly/monthly to settle any pending payments to be made to astrologers
*/
const settlementsCron = async () => {

    console.log('INSIDE WEEKLY SETTLEMENTS');

    let data = await transModel.getPendingTransactions();
    console.log('\n\nTOTAL :- ', data);
    if (data.length > 0) {
        async.eachOfSeries(data, (eachData, key, cb) => {

            console.log('\n\nTOTAL :- ', eachData);

            // 1. Hit Razorpay Routes (Send AMT and ACC_ID)
            // 2. If SUCCESS
            //   i. Create a new Settlement for that Astrologer
            //  ii. Update settlement_id of all these Transactions
            // iii. Add a transaction_type "settlement" in transaction table for this settlement

            let astrologer = eachData._id;
            let totalAmt = eachData.total_amt;
            let txnIds = eachData.txn_ids;
            console.log('\n\nGENERATE START');

            // RAZORPAY DIRECT TRANSFER
            let pay_receipt = randomstring.generate(7);
            let instance = new Razorpay({ key_id: process.env.razor_key_id, key_secret: process.env.razor_key_secret })

            let options = {
                account: 'acc_id', // Please replace with appropriate ID.
                amount: parseInt(parseFloat(totalAmt).toFixed(2) * 100), // Amount in the smallest currency unit (Paise)
                currency: 'INR'
            };

            console.log('OPTIONS ', options);

            // instance.transfers.create(options, (err, transfer) => {
            // if (err) {
            //     console.log('RAZORPAY ERROR ', err);
            // }
            // else {
            //     console.log('RAZORPAY SUCCESS ', transfer);
            // if (transfer.status == 'success') {
            generateSettlement(astrologer, totalAmt, txnIds, (err, res) => {
                console.log('GENERATE COMPLETE\n\n');
                cb()
            })
            // }
            // else if (transafer.status == 'failure') {

            //     // SEND EMAIL TO ADMIN
            //     let mailData = {
            //         email: process.env.mail_username,
            //         subject: 'AstroWize - Transfer Failed',
            //         body:
            //             "<p>" +
            //             "Hello," +
            //             "<p>" +
            //             "This is to inform you that payment of astrologer " + astrologer.first_name + "of ₹" + parseFloat(totalAmt).toFixed(2) + " was unsuccessfull." +
            //             "<p>" +
            //             "Regards," +
            //             "<br>" +
            //             "Team AstroWize"
            //     };
            //     helper.sendEmail(mailData)

            //     console.log('RAZORPAY TRANSFER FAILED\n\n');
            //     cb()
            // }
            // }
            // })


        }, (err) => {

            console.log('--------- ASYNC DONE ----------');

        })
    }
}

const generateSettlement = async (astrologer, totalAmt, txnIds, next) => {

    console.log('GENERATE NAME     :- ', astrologer.first_name);
    console.log('GENERATE AMT      :- ', totalAmt);
    console.log('GENERATE IDs      :- ', txnIds);

    let newSettlement = new settleModel({
        astrologer_id: astrologer._id,
        transaction_ids: txnIds,
        payment_date: new Date(),
        transaction_amt: parseFloat(totalAmt).toFixed(2),
        razor_fee: 1
    })

    newSettlement.save((error, savedData) => {
        if (error) {
            console.log('GENERATE SETTLEMENT ERROR :-', err);
            next()
        }
        else {
            transModel.updateMany({ _id: { $in: txnIds } }, { settlement_id: savedData._id }).exec((err, saveData) => {

                // SEND EMAIL TO ADMIN
                let mailData = {
                    email: 'rhuturaj.g@infiny.in',
                    subject: 'AstroWize - Money Settled!',
                    body:
                        "<p>" +
                        "Hello," +
                        "<p>" +
                        "This is to inform you that payment of astrologer " + astrologer.first_name + " of ₹" + parseFloat(totalAmt).toFixed(2) + " has been settled successfully!" +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)

                // SEND NOTIFICATION TO ASTROLOGER
                let msg = "Good news! Your money has been settled by Admin. Check your AstroWize account balance to know more."
                let astroData = {
                    msg: msg,
                    title: "",
                    device_token: astrologer.device_token,
                    data: {
                        targetedScreen: 'my_earnings',
                        message: msg,
                        flag: "Transaction Settlement"
                    }
                }

                astroData.data.user_id = astrologer._id
                notificationController.sendNotification(astroData)

                let transData = new transModel({
                    transaction_type: 'settlement',
                    payment_status: 'success',
                    payment_type: 'razorpay_routes',
                    astrologer_id: astrologer._id,
                    transaction_amt: parseFloat(totalAmt).toFixed(2),
                    client_transaction_amt: parseFloat(totalAmt).toFixed(2),
                    settlement_id: savedData._id,
                    razor_fee: 1
                })

                transModel.saveTransaction(transData, (err, savedTrans) => {
                    if (err) {
                        console.log('GENERATE SETTLEMENT ERROR :-', err);
                        next()
                    }
                    else {
                        console.log('GENERATE SETTLEMENT SUCCESS :-', savedTrans);
                        next()
                    }
                })
            })
        }
    })

}

module.exports = {
    createSettlement,
    getSettlementAstrologers,
    getSettlementsList,
    settlementsCron
}