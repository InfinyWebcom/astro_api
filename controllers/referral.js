/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');

/* Models */
const userModel = require('../models/user');
const referralModel = require('../models/referral');

/*
# parameters: token,
# purpose: referral code list
*/
const getReferralList = async (req, res) => {
    console.log('getReferralList req.body ', req.body);

    let data = await userModel.getAllReferrors(req);

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "Referral list",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

/*
# parameters: token,
# purpose: referral details
*/
const getReferralDetails = async (req, res) => {
    console.log('getReferralDetails req.body ', req.body);

    const result = validationResult(req);

    console.log('getReferralDetails errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let data = await referralModel.getDetails(req);

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "Referral list",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

/*
# parameters: token,
# purpose: login for users
*/
const validateReferral = async (req, res) => {
    console.log('validateReferral req.body ', req.body);

    const result = validationResult(req);

    console.log('validateReferral errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let data = await userModel.getUserCode(req);

    if (data) {
        return res.status(200).json({
            error: false,
            isExist: true
        })
    }
    
    return res.status(200).json({
        error: false,
        isExist: false
    })
}

/*
# parameters: token,
# purpose: To add referror from admin
*/
const addReferror = async (req, res) => {
    console.log('addReferror req.body ', req.body);
    const result = validationResult(req);

    console.log('addReferror errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserFromQuery({ email: req.body.email.trim().toLowerCase() }); //await userModel.getUser(req.body);
    if (userData) {
        return res.status(200).json({
            title: 'User email ID already exists.',
            error: true
        })
    }

    let mobileData = await userModel.getUserFromQuery({ mobile: req.body.mobile });
    if (mobileData) {
        return res.status(200).json({
            title: 'User mobile already exists.',
            error: true
        })
    }

    //user model
    var newUser = new userModel({
        first_name: req.body.first_name,
        email: req.body.email.trim().toLowerCase(),
        user_type: req.body.user_type,
        mobile: req.body.mobile,
        added_from: "home",
        referral_code: req.body.referral_code
    })

    let mailData = {
        email: newUser.email,
        subject: 'Welcome To AstroWize',
        body:
            '<p>' +
            'Your referral code is: ' + req.body.referral_code
    };
    helper.sendEmail(mailData);

    newUser.save((err, savedUser) => {
        console.log('addReferror userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to save user details.',
                error: true
            });
        }
        return res.status(200).json({
            title: "Referral added successfully",
            error: false,
            data: savedUser
        });
    })
}

/*
# parameters: token,
# purpose: block referral code
*/
const blockReferralCode = async (req, res) => {
    console.log('blockReferralCode req.body ', req.body);

    const result = validationResult(req);

    console.log('blockReferralCode errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserFromQuery({ _id: req.body.referror_id });
    if (!userData) {
        return res.status(200).json({
            title: 'User not exists.',
            error: true
        })
    }
    
    var title = ""
    if (userData.refer_code_blocked == true) {
        userData.refer_code_blocked = false
        title = "Referral code unblocked successfully"
    }
    else {
        userData.refer_code_blocked = true
        title = "Referral code blocked successfully"
    }
    userData.save((err, savedUser) => {
        console.log('blockReferralCode userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to save user details.',
                error: true
            });
        }
        return res.status(200).json({
            title: title,
            error: false,
            data: savedUser
        });
    })
}

/*
# parameters: token,
# purpose: function for cron sent mail to referrors about their transactions
*/
const referralTransactions = async (/*req, res*/) => {
//   console.log('referralTransactions req.body ', req.body);

    let data = await referralModel.getPayReferrors();

    //get user one by one
    async.forEach(data, (referral, callback) => {        
        console.log('referralTransactions referral ', referral.referror_id.email, referral.total_amount);
        
        let mailData = {
            email: referral.referror_id.email,
            subject: 'Your monthly referral summary report on Astrowize',
            body:
                "<p>" +
                "Hello " + referral.referror_id.first_name + "," + 
                "<p>" +
                "Here's your detailed monthly summary of your referrals. Thank you for going an extra mile for AstroWize." + 
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData);

        callback();
    }, function(err) {
        console.log('referralTransactions async forEach done');

        /*
        return res.status(200).json({
            title: "Tip Details",
            error: false,
            data: tipData
        });*/
    });
}

module.exports = {
    getReferralList,
    getReferralDetails,
    validateReferral,
    addReferror,
    blockReferralCode,
    referralTransactions
}