/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
var moment = require('moment-timezone');

/* Models */
const callRequestModel = require('../models/callRequest');

/*
# parameters: token,
# purpose: sending call request from home page
*/
const addCallRequest = async (req, res) => {
    console.log('addCallRequest req.body ', req.body);

    const result = validationResult(req);

    console.log('addCallRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    var start = moment.tz(req.body.preferred_time, helper.getTimezone()).utc();

    let request = new callRequestModel({
        name: req.body.name,
        email: req.body.email,
        mobile: req.body.mobile,    
        preferred_time: start,//new Date(req.body.preferred_time),
        request_status: 'Requested',
    })
    
    request.save((error, data) => {
        console.log('addCallRequest error --- ', error, data);

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong when trying to save user details.',
                error: true
            });
        }

        //sent mail to admin
        var preferredTime = moment.tz(req.body.preferred_time, helper.getTimezone()).format('MMM DD, YYYY hh:mm a')

        console.log('addCallRequest preferredTime --- ', preferredTime);
        let adminMailData = {
            email: process.env.mail_username,
            subject: 'AstroWize - New call request through Website!',
            body:
                "<p>" +
                "Hello " + "Admin" + "," + 
                "<p>" +
                "You have received a new call request from " + req.body.name + "." + 
                "<p>" +
                "Their preferred time for calling is " + preferredTime + ". Please take necessary action." + 
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(adminMailData)

        return res.status(200).json({
            title: "Call request send successfully",
            error: false,
            data: data
        });
    })
}

/*
# parameters: token,
# purpose: Schedule call request from admin panel
*/
const scheduleCallRequest = async (req, res) => {
    console.log('scheduleCallRequest req.body ', req.body);

    const result = validationResult(req);

    console.log('scheduleCallRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    var start = moment.tz(req.body.call_time, helper.getTimezone()).utc();
    let data = await callRequestModel.getCallRequestById(req)

    data.request_status = 'Scheduled'
    data.astrologer_id = req.body.astrologer_id
    data.call_time = start//new Date(req.body.call_time)

    data.save((error, savedData) => {
        console.log('getReferrals error --- ', error, savedData);

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong when trying to save user details.',
                error: true
            });
        }
        return res.status(200).json({
            title: "Call scheduled successfully",
            error: false,
            data: savedData
        });
    })
}

/*
# parameters: token,
# purpose: Complete and settle call request from admin panel
*/
const completeCallRequest = async (req, res) => {
    console.log('completeCallRequest req.body ', req.body);

    const result = validationResult(req);

    console.log('completeCallRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let data = await callRequestModel.getCallRequestById(req)
    if (!data) {
        return res.status(200).json({
            title: 'No requests found',
            error: true
        });
    }

    var title = "Call settled successfully"
    data.request_status = req.body.request_status   //'Completed'
    if (req.body.request_status == 'Completed') {
        data.call_rate = req.body.call_rate
        data.call_duration = req.body.call_duration
        title = "Call completed successfully"
    }    

    data.save((error, savedData) => {
        console.log('getReferrals error --- ', error, savedData);

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong when trying to save user details.',
                error: true
            });
        }
        return res.status(200).json({
            title: title,
            error: false,
            data: savedData
        });
    })
}

/*
# parameters: token,
# purpose: deny call request from admin panel
*/
const denyCallRequest = async (req, res) => {
    console.log('denyCallRequest req.body ', req.body);

    const result = validationResult(req);

    console.log('denyCallRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    callRequestModel.findOneAndDelete({ _id: req.body.request_id }, function (error, data) { 
        if (error) {
            return res.status(200).json({
                title: 'Something went wrong',
                error: true
            });
        }
        return res.status(200).json({
            title: "Call request denied successfully",
            error: false
        });
    });
}

/*
# parameters: token
# purpose: get call requests list
*/
const callRequestList = async (req, res) => {
    let data = await callRequestModel.getCallRequests(req);

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "Call request listing",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

module.exports = {
    addCallRequest,
    scheduleCallRequest,
    completeCallRequest,
    denyCallRequest,
    callRequestList
}