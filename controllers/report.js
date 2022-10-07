/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const { check, validationResult, body } = require('express-validator');
const randomstring = require("randomstring");
var jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
var moment = require('moment-timezone');

/* Model */
const userModel = require('../models/user');
const reportModel = require('../models/report');
const transModel = require('../models/transaction');

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

/*
# parameters: token
# purpose: to request report from an astrologer
*/
const requestReport = async (req, res) => {
    console.log('requestReport req.body ', req.body);
    console.log('requestReport req.user ', req.user);

    const result = validationResult(req);
    console.log('requestReport errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    var birth = moment.tz(req.body.birth_date, helper.getTimezone()).utc() //new Date(req.body.birth_date)
    let astrologer = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });

    if (!astrologer) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    let signData = await helper.getZodiacSign(new Date(req.body.birth_date).getMonth(), new Date(req.body.birth_date).getDate());
    console.log('requestReport signData ', signData);

    var msg = "Your wallet balance is insufficient for this report. This astrologer charges ₹" + parseFloat(astrologer.client_report_rate).toFixed(0)

    if (parseFloat(req.user.wallet_balance) < parseFloat(astrologer.client_report_rate)) {
        return res.status(200).json({
            title: msg,
            error: true
        });
    }

    var newReport = new reportModel({
        payment_status: 'success',
        consumer_id: req.user._id,
        report_status: "Ordered",
        astrologer_id: req.body.astrologer_id,
        report_rate: parseFloat(astrologer.report_rate).toFixed(2),
        client_report_rate: parseFloat(astrologer.client_report_rate).toFixed(2),
        name: req.body.name,
        birth_date: birth,
        place: req.body.place,
        astro_sign: signData._id
    })

    newReport.save((err, savedReport) => {
        console.log('requestReport astrologerData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong.',
                error: true
            });
        }

        var remain_amt = parseFloat(parseFloat(req.user.wallet_balance) - parseFloat(astrologer.client_report_rate)).toFixed(2)

        if (remain_amt >= 0) {
            req.user.wallet_balance = remain_amt
        }
        else {
            req.user.wallet_balance = 0
        }
        req.user.save((err, userData) => {
            console.log('jobSeeker in events userData', err, userData);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong.',
                    error: true
                });
            }

            //to save transaction
            var transData = new transModel({
                transaction_type: 'report',
                consumer_id: req.user._id,
                payment_status: "success",
                report_id: savedReport._id,
                payment_type: "wallet",
                astrologer_id: req.body.astrologer_id,
                transaction_amt: astrologer.report_rate,
                client_transaction_amt: astrologer.client_report_rate
            })
            transModel.saveTransaction(transData, (err, savedTrans) => {
                console.log('jobSeeker in events savedData', err, savedTrans);

                if (err) {
                    return res.status(200).json({
                        title: 'Something went wrong.',
                        error: true
                    });
                }

                //to astrologer
                var msg = 'Check up time! A customer has requested their detailed report. Click here to know more.'
                let astrologerData = {
                    msg: msg,
                    title: "",
                    device_token: astrologer.device_token,

                    data: {
                        targetedScreen: 'report_listing',
                        message: msg,
                        flag: "Report Order",
                    }
                }
                astrologerData.data.user_id = astrologer._id
                astrologerData.data.sec_user_id = req.user._id
                notificationController.sendNotification(astrologerData)

                //send mail to astrologer
                let mailData = {
                    email: astrologer.email,
                    subject: 'Order for a detailed report',
                    body:
                        "<p>" +
                        "Hello " + astrologer.first_name + "," +
                        "<p>" +
                        "A customer has ordered their detailed report. Know more on AstroWize app. Thank you." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)

                //to consumer
                var msg = "Reported! Your report request has been sent successfully to " + astrologer.first_name + " and ₹ " + astrologer.client_report_rate + " has been deducted from your Astrowize wallet."
                let consumerData = {
                    msg: msg,
                    title: "",
                    device_token: req.user.device_token,
                    data: {
                        targetedScreen: 'history_screen',
                        message: msg,
                        flag: "Report Order",
                    }
                }
                consumerData.data.user_id = req.user._id
                consumerData.data.sec_user_id = astrologer._id
                notificationController.sendNotification(consumerData)

                //send mail to consumer
                let consumerMsgBody = msg;
                let consumerMailData = {
                    email: req.user.email,
                    subject: 'AstroWize - Report ordered successfully!',
                    body:
                        "<p>" +
                        "Hello " + req.user.first_name + "," +
                        "<p>" +
                        "Your report request has been sent successfully to " + astrologer.first_name + " and ₹ " + astrologer.client_report_rate + " has been deducted from your Astrowize wallet. Thank you for using our services." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(consumerMailData)

                return res.status(200).json({
                    title: "Report ordered successfully",
                    error: false,
                    data: savedReport
                });
            })
        })
    })
}

/*
# parameters: token
# purpose: to upload report by astrologer
*/
const uploadReport = async (req, res) => {
    console.log('uploadReport req.body ', req.body);
    console.log('uploadReport req.user ', req.user);

    const result = validationResult(req);
    console.log('uploadReport errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let report = await reportModel.getReportById(req);
    console.log('uploadReport report ', report);

    if (!report) {
        return res.status(200).json({
            title: 'Report not found',
            error: true
        })
    }

    //image or pdf
    let dir = './assets/reports/';
    let tempfileName = helper.base64Upload(dir, req.body.report_url)

    report.report_url = '/reports/' + tempfileName
    report.report_status = "Uploaded",

        report.save((err, savedData) => {
            console.log('uploadReport userData save err ', err);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to update user details.',
                    error: true
                });
            }

            //to admin
            let mailData = {
                email: process.env.mail_username,
                subject: ' AstroWize - Report uploaded!',
                body:
                    "<p>" +
                    "Hello " + "Admin" + "," +
                    "<p>" +
                    "Astrologer " + report.astrologer_id.first_name + " has uploaded a detailed report for report request from " + report.consumer_id.first_name + "." +
                    "<p>" +
                    "Kindly approve/deny it from the Admin panel." +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData);

            return res.status(200).json({
                title: "Report uploaded successfully",
                error: false,
                data: savedData
            });
        })
}

/*
# parameters: token
# purpose: to cancel report
*/
const cancelReport = async (req, res) => {
    console.log('cancelReport req.body ', req.body);
    console.log('cancelReport req.user ', req.user.user_type);

    const result = validationResult(req);
    console.log('cancelReport errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let report = await reportModel.getReportById(req);
    console.log('cancelReport report ', report);

    if (!report) {
        return res.status(200).json({
            title: 'Report not found',
            error: true
        })
    }

    if (report.report_status == "Cancelled") {
        return res.status(200).json({
            title: 'You already cancelled this report',
            error: true,
        });
    }

    //refund to wallet
    let wallet_balance = parseFloat(report.consumer_id.wallet_balance + report.client_report_rate).toFixed(2)
    console.log('cancelReport wallet_balance---', report.consumer_id.wallet_balance, '---', wallet_balance)

    report.consumer_id.wallet_balance = wallet_balance

    report.report_status = "Cancelled"
    report.save((err, savedData) => {
        console.log('cancelReport savedData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update details.',
                error: true
            });
        }

        report.consumer_id.save((err, savedUser) => {
            console.log('cancelReport userData save err ', err);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to update details.',
                    error: true
                });
            }

            // to astrologer
            if (req.user.user_type == 'consumer') {
                var msg = 'Hold on! The customer has cancelled their report order. '
                let astrologerData = {
                    msg: msg,
                    title: "",
                    device_token: report.astrologer_id.device_token,
                    data: {
                        targetedScreen: 'report_history',
                        message: msg,
                        flag: "Report Cancelled",
                    }
                }
                astrologerData.data.user_id = report.astrologer_id._id
                astrologerData.data.sec_user_id = report.consumer_id._id
                notificationController.sendNotification(astrologerData)

                //send mail to astrologer
                let mailData = {
                    email: report.astrologer_id.email,
                    subject: 'Report Cancelled',
                    body:
                        "<p>" +
                        "Hello " + report.astrologer_id.first_name + "," +
                        "<p>" +
                        "The customer has cancelled their request for a report. Please wait till the time they initiate another request. Thank you." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(mailData)
            }

            // to consumer
            if (req.user.user_type == 'astrologer') {
                var consumerMsg = "Unreported! Your report request was cancelled and ₹ " + report.client_report_rate + " has been restored in your Astrowize wallet. Click here to know the reason for cancellation"
                let consumerData = {
                    msg: consumerMsg,
                    title: "",
                    device_token: report.consumer_id.device_token,
                    data: {
                        message: consumerMsg,
                        flag: "Report Cancelled",
                        targetedScreen: 'report_history',
                    }
                }
                consumerData.data.user_id = report.consumer_id._id
                consumerData.data.sec_user_id = report.astrologer_id._id

                notificationController.sendNotification(consumerData)

                //send mail to consumer
                let consumerMsgBody = consumerMsg;
                let consumerMailData = {
                    email: report.consumer_id.email,
                    subject: 'AstroWize - Report order cancelled!',
                    body:
                        "<p>" +
                        "Hello " + report.astrologer_id.first_name + "," +
                        "<p>" +
                        "Your personal astrologer has cancelled your report request and ₹ " + report.client_report_rate + " has been restored in your Astrowize wallet. Head over to Astrowize app to know the reason for cancellation." +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(consumerMailData)
            }

            // to save transaction
            var transData = new transModel({
                transaction_type: 'report',
                consumer_id: report.consumer_id._id,
                astrologer_id: report.astrologer_id._id,
                report_id: savedData._id,
                payment_status: "success",
                payment_type: "wallet",
                pay_type: "refund",
                transaction_amt: report.client_report_rate,
                client_transaction_amt: report.client_report_rate
            })
            transModel.saveTransaction(transData, (err, saved) => {
                console.log('Report in cancelled savedData', err, saved);

                if (err) {
                    return res.status(200).json({
                        title: 'Something went wrong, Please try again..',
                        error: true,
                    });
                }
                return res.status(200).json({
                    title: "Report cancelled successfully",
                    error: false,
                    data: savedData
                });
            })
        })
    })
}

/*
# parameters: token
# purpose: to get report template
*/
const getReportTemplate = async (req, res) => {
    console.log('getReportTemplate req.body ', req.body);
    console.log('getReportTemplate req.user ', req.user);

    let report_template = process.env.baseUrl + "/images/report_template.pdf"

    //send mail to astrologer
    let astrologerMsgBody = 'Hi ' + req.user.first_name + ',\n\n<br><br>' + 'Please ' + '<a href="' + report_template + '">click here</a>' + ' to download your report template'
    let astrologerMailData = {
        email: req.user.email,
        subject: 'Report Template',
        body:
            '<p>' + astrologerMsgBody
    };
    helper.sendEmail(astrologerMailData)

    return res.status(200).json({
        title: "Report cancelled successfully",
        error: false,
        data: report_template
    });
}

module.exports = {
    requestReport,
    uploadReport,
    cancelReport,
    getReportTemplate
}