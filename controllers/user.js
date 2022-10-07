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
const Razorpay = require('razorpay')
var moment = require('moment-timezone');
var fs = require('fs');
const nodeGeocoder = require('node-geocoder');

/* Model */
const languagesModel = require('../models/language');
const specialityModel = require('../models/speciality');
const userModel = require('../models/user');
const notificationModel = require('../models/notification');
const tipModel = require('../models/tipoftheday');
const reportModel = require('../models/report');
const supportModel = require('../models/support');
const transModel = require('../models/transaction');
const referralModel = require('../models/referral');
const supportCategoryModel = require('../models/supportCategory')

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

/*
# parameters: token,
# purpose: login for consumer
*/
const signin = async (req, res) => {
    console.log('signin req.body ', req.body);

    const result = validationResult(req);

    console.log('signin errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserSignin(req);

    console.log('signin userData ', userData);

    if (!userData || userData.user_type != req.body.user_type || userData.is_deleted == true) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }

    var userValid = false
    //check password and fb google id
    if (userData.password && req.body.password && bcrypt.compareSync(req.body.password, userData.password)) {
        userValid = true
    }
    else if (req.body.google_id && req.body.google_id != ""/* && req.body.google_id == userData.google_id*/) {
        userValid = true
        if (!userData.google_id && req.body.google_id) {
            userData.google_id = req.body.google_id
        }
    }
    else if (req.body.facebook_id && req.body.facebook_id != "" /*&& req.body.facebook_id == userData.facebook_id*/) {
        userValid = true
        if (!userData.facebook_id && req.body.facebook_id) {
            userData.facebook_id = req.body.facebook_id
        }
    }
    if (!userValid && !req.body.google_id && !req.body.facebook_id) {
        return res.status(200).json({
            title: 'You have entered an invalid phone number or password',
            error: true
        });
    }
    if (!userValid && (req.body.google_id || req.body.facebook_id)) {
        return res.status(200).json({
            title: 'This user does not exist',
            error: true
        });
    }
    //if user not verified
    if (userData.is_blocked) {
        return res.status(200).json({
            title: "You are blocked by admin",
            error: true
        });
    }
    console.log('login userData sms ', '91' + userData.mobile.replace(/\D/g, ''));

    //if user not verified
    if (!userData.isVerifiedPhone) {
        var otp = Math.floor(1000 + Math.random() * 9000);
        userData.otp = otp
        userData.otp_expired = Date.now() + 600000; // 10 min
        let msgBody = otp + " is your One Time Password. Please complete your OTP verification for login. OTP is Valid for 10 min.";
        let mailData = {
            email: userData.email,
            subject: 'Login successful',
            body:
                '<p>' + msgBody
        };
        //    helper.sendEmail(mailData)

        //sms
        var smsData = {}
        smsData.to = ['91' + userData.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828514874258"//"72947515-c5d3-4579-af0c-9bdc941e2aa8"
        smsData.message = "Hello " + userData.first_name + ",Your login OTP is " + otp + ". Please enter it to proceed. Thanks, FINOTO."

        let sms = helper.sendSMS(smsData)
    }
    else if (req.body.device_token) {
        userData.device_token = [req.body.device_token];
        /*
        if (userData.device_token) {
            let index = userData.device_token.findIndex((e) => e == req.body.device_token)
            console.log("signin index", index)
            if (index > -1) {
                //    userData.device_token.splice(index, 1);
            } else {
                userData.device_token.push(req.body.device_token)
            }
        }
        else {
            userData.device_token = [req.body.device_token];
        }*/
    }

    if (req.body.device_type) {
        userData.device_type = req.body.device_type;
    }

    userData.save((err, savedUser) => {
        console.log('signin userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        userData.isMobile = req.body.device_token ? true : false
        helper.generateToken(userData, (token) => {

            if (!userData.isVerifiedPhone) {
                return res.status(200).json({
                    title: "User not verified",
                    error: true,
                    token: token,
                    data: savedUser
                });
            }
            return res.status(200).json({
                title: "Logged in successfully",
                error: false,
                token: token,
                data: savedUser
            });
        })
    })
}

/*
# parameters: token,
# purpose: login for astrologer and login by phone for consumer
*/
const login = async (req, res) => {
    console.log('login req.body ', req.body);

    const result = validationResult(req);

    console.log('login errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserSignin(req);

    console.log('login userData ', userData);

    if (!userData || userData.user_type != req.body.user_type) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    if (userData.is_deleted) {
        return res.status(200).json({
            title: 'You are deleted by admin',
            error: true
        })
    }

    if (userData.approval_status == "pending") {
        return res.status(200).json({
            title: 'You are not approved by admin',
            error: true
        })
    }

    var otp = randomstring.generate({
        length: 4,
        charset: 'numeric'
    });
    console.log("login otp", otp)

    userData.otp = otp
    userData.otp_expired = Date.now() + 600000; // 10 min

    if (userData._id == "5fe4663334b01e806943538b") {
        userData.otp = "1234"
    }
    /*
    if (req.body.device_token) {
        if (userData.device_token) {
            let index = userData.device_token.findIndex((e) => e == req.body.device_token)
            console.log("login index", index)
            if (index > -1) {
                //    userData.device_token.splice(index, 1);
            } else {
                userData.device_token.push(req.body.device_token)
            }
        }
        else {
            userData.device_token = [req.body.device_token];
        }
    }*/

    if (req.body.device_type) {
        userData.device_type = req.body.device_type;
    }

    userData.save((err, savedUser) => {
        console.log('login userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        let msgBody = otp + " is your One Time Password. Please complete your OTP verification for login. OTP is Valid for 10 min.";
        let mailData = {
            email: userData.email,
            subject: 'Login successful',
            body:
                '<p>' + msgBody
        };
        //    helper.sendEmail(mailData)

        //sms
        var smsData = {}
        smsData.to = ['91' + userData.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828514874258"//"72947515-c5d3-4579-af0c-9bdc941e2aa8"
        smsData.message = "Hello " + userData.first_name + ",Your login OTP is " + otp + ". Please enter it to proceed. Thanks, FINOTO."

        let sms = helper.sendSMS(smsData)
        console.log('login userData sms ', sms);

        userData.isMobile = req.body.device_token ? true : false
        helper.generateToken(userData, (token) => {

            userData
                .populate('languages_spoken')
                .populate('specialities')
                .populate('astro_sign')
                .execPopulate()
                .then(function (data) {

                    return res.status(200).json({
                        title: "Logged in successfully",
                        error: false,
                        token: token,
                        data: data
                    });
                })
        })
    })
}

/*
# parameters: token,
# purpose: login for astrologer and login by phone for consumer
*/
const facebookLogin = async (req, res) => {
    const result = validationResult(req);

    console.log('facebookLogin errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    const userFieldSet = 'id, name,first_name,last_name, about, email, accounts, link, is_verified, significant_other, relationship_status, website, picture.type(large), photos, feed';
    const options = {
        method: 'GET',
        uri: `https://graph.facebook.com/v2.8/${req.body.userID}`,
        qs: {
            access_token: req.body.access_token,
            fields: userFieldSet
        }
    };
    requests(options)
        .then(fbRes => {
            console.log('facebookLogin fbRes ', fbRes);

            return res.status(200).json({
                title: "Logged in successfully",
                error: false,
                token: fbRes
            });
        })


    request('https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=' + req.body.id_token, function (error, response, data) {

    })
}

/*
# parameters: newPassword
# purpose: change Password for astrologer, consumer, admin
*/
const changePassword = async (req, res) => {
    const result = validationResult(req);

    console.log('changePassword errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = req.user;
    console.log('changePassword userData ', userData);

    userData.password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10));

    userData.save((err, savedUser) => {
        console.log('changePassword userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        let msg = 'Congrats. Your password has been been changed.';
        let mailData = {
            email: savedUser.email,
            subject: 'Password Changed',
            body:
                '<p>' + msg
        };
        helper.sendEmail(mailData);

        if (savedUser && savedUser.device_token && savedUser.device_token.length > 0) {
            let data = {
                msg: msg,
                title: "",
                device_token: savedUser.device_token,
                data: {
                    message: msg,
                    flag: "Password Change",
                }
            }
            data.data.user_id = savedUser._id

            notificationController.sendNotification(data)
        }
        return res.status(200).json({
            title: "Password changed successfully",
            error: false,
            data: savedUser
        });
    })
}

/*
# parameters: email,
# purpose: send forgot pass otp on email for astrologer, consumer, admin
# OTP is valid for 10 min
*/
const forgotPassword = async (req, res) => {
    console.log("forgotPassword req.body", req.body);

    const result = validationResult(req);

    console.log('forgotPassword errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let query = req.body.email ? { email: req.body.email.trim().toLowerCase(), user_type: req.body.user_type ? req.body.user_type : 'admin' } : { mobile: req.body.mobile.trim(), user_type: req.body.user_type }

    let userData = await userModel.getUserFromQuery(query);

    console.log("forgotPassword userData", userData);

    if (!userData || userData.user_type != req.body.user_type) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }
    if (userData.is_deleted) {
        return res.status(200).json({
            title: 'You are deleted by admin',
            error: true
        })
    }

    var token = randomstring.generate({
        length: 4,
        charset: 'numeric'
    });
    console.log("forgotPassword token", token)

    userData.otp = token
    userData.otp_expired = Date.now() + 600000; // 10 min
    userData.save((err, savedUser) => {
        console.log('forgotPassword userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        //mail
        let msgBody = token + " is your One Time Password. Please complete your OTP verification. OTP is Valid for 10 min.";
        let mailData = {
            email: savedUser.email,
            subject: 'One Time Password',
            body:
                '<p>' + msgBody
        };
        //    helper.sendEmail(mailData)

        //sms
        var smsData = {}
        smsData.to = ['91' + userData.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828514874258"//"72947515-c5d3-4579-af0c-9bdc941e2aa8"
        smsData.message = "Hello " + userData.first_name + ",Your login OTP is " + token + ". Please enter it to proceed. Thanks, FINOTO."

        let sms = helper.sendSMS(smsData)

        helper.generateToken(userData, (token) => {
            return res.status(200).json({
                title: "OTP sent successfully",
                error: false,
                token: token
            });
        })
    })
}

/*
# parameters: token,
# purpose: verify otp for forgot password and signup for astrologer, consumer, admin
*/
const verifyOTP = async (req, res) => {
    console.log("verifyOTP req.body", req.body);

    const result = validationResult(req);

    console.log('verifyOTP errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    const decoded = jwt.decode(req.body.token, "astroapi");
    console.log("verifyOTP authenticateUser", decoded)

    if (!decoded) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }
    let userData = await userModel.getUserFromQuery({ email: decoded.email, otp: req.body.verificationOtp, otp_expired: { $gte: Date.now() } });

    console.log("verifyOTP userData", userData);

    if (!userData) {
        return res.status(200).json({
            title: 'OTP entered is not valid or expired',
            error: true
        })
    }
    if (userData.is_deleted) {
        return res.status(200).json({
            title: 'You are deleted by admin',
            error: true
        })
    }
    if (userData._id != "5fe4663334b01e806943538b") {
        userData.otp = undefined;
        userData.otp_expired = undefined;
    }

    //    userData.isVerifiedEmail = false
    userData.isVerifiedPhone = true

    if (req.body.device_token) {
        userData.device_token = [req.body.device_token];
        /*
        if (userData.device_token) {
            let index = userData.device_token.findIndex((e) => e == req.body.device_token)
            console.log("login index", index)
            if (index > -1) {
                //    userData.device_token.splice(index, 1);
            } else {
                userData.device_token.push(req.body.device_token)
            }
        }
        else {
            userData.device_token = [req.body.device_token];
        }*/
    }

    if (req.body.device_type) {
        userData.device_type = req.body.device_type;
    }

    userData.save((err, savedUser) => {
        console.log('login userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        //mail
        let mailData = {
            email: savedUser.email,
            subject: 'AstroWize - Your Phone Number is verified!',
            body:
                "<p>" +
                "Hello " + savedUser.first_name + "," +
                "<p>" +
                "Your contact details are successfully verified. Thank you for registering on AstroWize." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData)

        userData.isMobile = req.body.device_token ? true : false
        helper.generateToken(userData, (token) => {
            userData
                .populate('languages_spoken')
                .populate('specialities')
                .populate('astro_sign')
                .execPopulate()
                .then(function (data) {

                    return res.status(200).json({
                        title: "Otp verified successfully.",
                        error: false,
                        token: token,
                        data: data
                    });
                })
        })
    })
}

/*
# parameters: userToken
# Variables used : token
# purpose: to logout user for astrologer, consumer, admin
*/
const userLogout = async (req, res) => {
    console.log('userLogout req', req.body)

    let reqUser = req.user;
    console.log('userLogout reqUser', reqUser)

    let userData = reqUser//await userModel.getUser(reqUser);

    console.log('userLogout userData ', userData);

    if (!userData) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }

    let index = userData.device_token.findIndex((e) => e == req.body.device_token)
    console.log("userLogout index", index)
    if (index > -1) {
        userData.device_token.splice(index, 1);

        userData.save().then();
    }
    return res.status(200).json({
        title: 'Logout successful',
        error: false
    });
}

/*
# parameters: userToken
# Variables used : token
# purpose: remote validation of email, mobile for astrologer, consumer, admin
*/
const validateEmail = async (req, res) => {
    console.log("validateEmail req.body", req.body);

    const result = validationResult(req);
    console.log('validateEmail errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    let query = req.body.email ? { email: req.body.email.trim().toLowerCase(), user_type: req.body.user_type } : { mobile: req.body.mobile, user_type: req.body.user_type }

    let userData = await userModel.getUserFromQuery(query);

    console.log("validateEmail userData", userData);

    if (userData && req.body.user_id) {
        if (userData && (ObjectId(userData._id).equals(ObjectId(req.body.user_id)))) {
            return res.status(200).json({
                error: false,
                isExist: false
            })
        }
        return res.status(200).json({
            error: false,
            isExist: true
        })
    } else if (userData && !req.body.user_id) {
        return res.status(200).json({
            error: false,
            isExist: true
        })
    }
    else {
        return res.status(200).json({
            error: false,
            isExist: false
        })
    }
}

/*
# parameters: userToken
# purpose: to send tip of the day to consumers
*/
const sendTipOfTheDay = (/*req, res*/) => {
    console.log('sendTipOfTheDay start');

    userModel.find({ user_type: "consumer" })
        .exec((err, userData) => {
            if (err) {
                console.log('sendTipOfTheDay err');
            }
            console.log('sendTipOfTheDay userData ', userData.length);

            let todayStr = new Date().toISOString().slice(0, 10)
            console.log(todayStr)

            let data = { tip_date: todayStr }
            tipModel.getTip(data, (err, tipData) => {
                console.log('sendTipOfTheDay tipData ', err, tipData);

                if (err) {
                    return
                }

                if (tipData) {
                    //get user one by one
                    async.forEach(userData, (user, callback) => {
                        console.log('sendTipOfTheDay user.astro_sign ', user.astro_sign);

                        let index = tipData.tip.findIndex((e) => e.sign._id.toString() == user.astro_sign.toString())

                        console.log('sendTipOfTheDay index ', index);
                        if (index > -1 && tipData.tip[index].description != "") {
                            let msg = "Tip of the day! " + tipData.tip[index].sign.name + ", " + tipData.tip[index].description

                            console.log('sendTipOfTheDay msg index ', msg);
                            if (user /*&& user.device_token && user.device_token.length > 0*/) {
                                //push to consumer
                                let data = {
                                    msg: msg,
                                    title: "",
                                    device_token: user.device_token,
                                    data: {
                                        targetedScreen: 'today_horoscope',
                                        message: msg,
                                        flag: "Tip of the day",
                                    }
                                }
                                data.data.user_id = user._id
                                notificationController.sendNotification(data)

                                //mail to consumer
                                let referMailData = {
                                    email: user.email,
                                    subject: ' AstroWize - Tip of the day!',
                                    body:
                                        "<p>" +
                                        "Hey " + tipData.tip[index].sign.name + "," +
                                        "<p>" +
                                        tipData.tip[index].description +
                                        "<p>" +
                                        "Want more such tips? Head over to Astrowize app now." +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };
                                helper.sendEmail(referMailData)

                                //mail to admin
                                let referMsgBodyAd = msg;
                                let referMailDataAd = {
                                    email: 'eldhose.m@infiny.in',
                                    subject: 'Tip of the day',
                                    body:
                                        '<p>' + referMsgBodyAd
                                };
                                helper.sendEmail(referMailDataAd)
                            }
                        }

                        callback();
                    }, function (err) {
                        console.log('async forEach done');

                        /*
                        return res.status(200).json({
                            title: "Tip Details",
                            error: false,
                            data: tipData
                        });*/
                    });
                }
            })
        })
}

/*
# parameters: userToken
# purpose: consumer signup
*/
const signup = async (req, res) => {
    console.log('signup req.body ', req.body);
    const result = validationResult(req);

    console.log('signup errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUser(req.body);
    console.log('signup body.date_of_birth- ', new Date(req.body.date_of_birth), moment.tz(req.body.date_of_birth, helper.getTimezone()).utc());
    var birth = req.body.date_of_birth ? moment.tz(req.body.date_of_birth, helper.getTimezone()).utc() : ''//new Date(req.body.date_of_birth)

    let signData = birth ? await helper.getZodiacSign(new Date(req.body.date_of_birth).getMonth(), new Date(req.body.date_of_birth).getDate()) : ''

    if (userData) {
        return res.status(200).json({
            title: 'User email ID already exists.',
            error: true
        })
    }

    let mobileData = await userModel.getUserFromQuery({ mobile: req.body.mobile, user_type: req.body.user_type });
    if (mobileData) {
        return res.status(200).json({
            title: 'User mobile already exists.',
            error: true
        })
    }

    //user model
    var newUser = new userModel({
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email.trim().toLowerCase(),
        user_type: req.body.user_type,
        mobile: req.body.mobile,
        unique_name: randomstring.generate(7),
        //    astro_sign: signData._id,
        //    gender: req.body.gender,
        isVerifiedEmail: false,
        isVerifiedPhone: false,
        background_color: helper.randomDarkColor(),
        //    birth_time: req.body.birth_time
    })

    if (req.body.birth_place) {
        newUser.birth_place = req.body.birth_place

        if (req.body.longitude && req.body.longitude != "" && req.body.latitude && req.body.latitude != "") {
            newUser.birth_location = [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
        } else {
            newUser.birth_location = [0.0, 0.0]
        }
    }

    //referral code 
    var referral_code = randomstring.generate(5);
    newUser.referral_code = referral_code
    let refUser = await userModel.getUserFromQuery({ referral_code: referral_code });

    if (refUser) {
        newUser.referral_code = randomstring.generate(5);
    }
    if (birth) {
        newUser.date_of_birth = birth
    }
    //social signup
    if (req.body.google_id) {
        newUser.google_id = req.body.google_id
    }
    if (req.body.facebook_id) {
        newUser.facebook_id = req.body.facebook_id
    }
    if (req.body.password) {
        newUser.password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10))
    }

    if (req.body.profile_url && req.body.profile_url != "") {
        console.log('signup profile_url ', req.body.profile_url.length)

        const response = await fetch(req.body.profile_url);
        const buffer = await response.buffer();

        console.log('signup response ', response)
        console.log('signup buffer ', buffer)

        let dir = './assets/consumers/';
        helper.createDir(dir);
        var picName = randomstring.generate({
            length: 8,
            charset: 'alphanumeric'
        });
        var abs = dir + picName + '.jpg';
        console.log('signup abs ', abs)

        fs.writeFile(abs, buffer, function (err) {
            if (err) {
                console.log("File image write error", err);
            }
        });

        newUser.profile_url = '/consumers/' + picName

        setTimeout(function () {
            helper.getThumbnail(dir, picName + '.jpg', picName, function (status) {
                console.log('signup getThumbnail -- ', status);
            });
        }, 2000);
        /*
        let newBase64Str = req.body.profile_url.replace(/(\r\n|\n|\r)/gm, "")
        var matches = newBase64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        console.log('signup matches', matches)
        if (!matches || matches.length !== 3) {
            console.log('signup matches error')
        }
        else if (req.body.profile_url && req.body.profile_url != "") {
            let dir = './assets/consumers/';
            let tempfileName = helper.base64Upload(dir, req.body.profile_url)
            var fileName = tempfileName + '.jpg';

            newUser.profile_url = '/consumers/' + tempfileName
    
            // generate thumbnail
            setTimeout(function () {
                helper.getThumbnail(dir, fileName, tempfileName, function (status) {
                    console.log('signup getThumbnail -- ', status);
                });
            }, 2000);
        }*/
    }

    var otp = Math.floor(1000 + Math.random() * 9000);
    console.log("signup otp", otp)

    newUser.otp = otp
    newUser.otp_expired = Date.now() + 600000; // 10 min

    helper.getPermissionGroupId(req.body.user_type.charAt(0).toUpperCase() + req.body.user_type.slice(1), (err, groupData) => {
        console.log('signup getPermissionGroupId ', err);
        if (err) {
            return res.status(200).json({
                title: "Something went wrong please try again.",
                error: true,
            });
        } else {
            newUser.groupId = groupData._id
        }
        newUser.save(async (err, savedUser) => {
            console.log('signup userData save err ', err);

            if (err) {
                return res.status(200).json({
                    title: 'Soemthing went wrong',
                    error: true
                });
            }
            //referral code validation
            if (req.body.referral_code && req.body.referral_code != "") {
                let data = await userModel.getUserCode(req);
                if (data) {
                    referralModel.addReferrals(data, savedUser)

                    //sent message to referror
                    var referMsg = "Voila! A consumer you referred has registered themself. Click here to view their profile."
                    if (data.user_type == "consumer") {
                        referMsg = newUser.first_name + "referred by you has successfully registered as a user on AstroWize using the referral code " + req.body.referral_code
                    }
                    let notifData = {
                        msg: referMsg,
                        title: "",
                        device_token: data.device_token,
                        data: {
                            message: referMsg,
                            flag: "Referral Consumer",
                        }
                    }
                    notifData.data.user_id = data._id
                    notificationController.sendNotification(notifData)

                    //send mail to referror
                    var mailMsg = newUser.first_name + " whom you referred to Astrowize has registered and created their profile. You can now see their profile on Astrowize app. Thank you."
                    if (data.user_type == "consumer") {
                        mailMsg = newUser.first_name + "referred by you has successfully registered as a user on AstroWize using the referral code " + req.body.referral_code +
                            "<p>" +
                            "You can earn a reward once {referred_consumer_name}  makes his/her first transaction. Keep on referring!"
                    }
                    let referMailData = {
                        email: data.email,
                        subject: 'AstroWize - Consumer referral registration successful!',
                        body:
                            "<p>" +
                            "Hello " + data.first_name + "," +
                            "<p>" +
                            mailMsg +
                            "<p>" +
                            "Regards," +
                            "<br>" +
                            "Team AstroWize"
                    };
                    helper.sendEmail(referMailData)
                }
            }

            //send mail
            let mailData = {
                email: savedUser.email,
                subject: 'AstroWize - Your account is verified!',
                body:
                    "<p>" +
                    "Hello " + savedUser.first_name + "," +
                    "<p>" +
                    "Thank you for registering your account with AstroWize. Welcome on board!." +
                    "<p>" +
                    "Enjoy your experience!" +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData)

            //sms
            var smsData = {}
            smsData.to = ['91' + savedUser.mobile.replace(/\D/g, '')]
            smsData.template_id = "1707160828514874258"//"72947515-c5d3-4579-af0c-9bdc941e2aa8"
            smsData.message = "Hello " + savedUser.first_name + ",Your login OTP is " + otp + ". Please enter it to proceed. Thanks, FINOTO."
            let sms = helper.sendSMS(smsData)

            //to admin 
            let consumerMailData = {
                email: process.env.mail_username,
                subject: 'AstroWize - New consumer registration!',
                body:
                    "<p>" +
                    "Hello Admin," +
                    "<p>" +
                    "has successfully registered as a Consumer on AstroWize. Check out their profile now." +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(consumerMailData);

            helper.generateToken(savedUser, (token) => {
                savedUser
                    .populate('languages_spoken')
                    .populate('specialities')
                    .populate('astro_sign')
                    .execPopulate()
                    .then(function (userData) {

                        return res.status(200).json({
                            title: "User saved successfully",
                            error: false,
                            token: token,
                            data: userData
                        });
                    })
            })
        })
    })
}

/*
# parameters: userToken
# purpose: to add support ticket
*/
const addSupport = async (req, res) => {
    console.log('addSupport req.body ', req.body);

    const result = validationResult(req);
    console.log('addSupport errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    var ticketId = randomstring.generate({
        length: 6,
        charset: 'numeric'
    });
    var newSupport = new supportModel({
        description: req.body.description,
        from_id: req.user._id,
        category: req.body.category,
        support_status: "Raised",
        support_id: 'TK' + ticketId
    })

    newSupport.save((err, savedData) => {
        console.log('requestReport userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong.',
                error: true
            });
        }

        let mailData = {
            email: process.env.mail_username,
            subject: 'AstroWize - New support ticket!',
            body:
                "<p>" +
                "Hello " + "Admin" + "," +
                "<p>" +
                "You have received a new support ticket from " + req.user.first_name + " asking for help. Please look into it. " +
                "Description: " + req.body.description +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData);

        return res.status(200).json({
            title: "Support send successfully",
            error: false,
            data: savedData
        });
    })
}

/*
# parameters: userToken
# purpose: api to get tip of the day
*/
const getTipOfTheDay = async (req, res) => {
    console.log('getTipOfTheDay req.user ', req.user);

    let tipData = await tipModel.getUserTip(req);

    if (!tipData) {
        return res.status(200).json({
            title: 'No tips found',
            error: true
        });
    }
    return res.status(200).json({
        title: 'Tips of the day',
        data: tipData[0],
        error: false
    });
}

/*
# parameters: token
# purpose: To get horoscope
*/
const getHoroscope = async (req, res) => {
    console.log('getHoroscope req.body ', req.body);

    const result = validationResult(req);
    console.log('getHoroscope errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    var sign = req.body.astro_sign.toLowerCase()
    let url = "https://json.astrologyapi.com/v1/sun_sign_prediction/daily/" + sign

    var date = new Date()

    console.log('getHoroscope date-- ', date)
    console.log('getHoroscope -- ', date.getMonth(), date.getDate(), date.getFullYear(), date.getHours(), date.getMinutes());

    var data = { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear(), hour: date.getHours(), min: date.getMinutes(), lat: 19.132, lon: 72.342, tzone: 5.5 }

    const headers = {
        "authorization": "Basic " + Buffer.from(process.env.userId + ":" + process.env.apiKey).toString('base64'), //Buffer.from('Hello World!').toString('base64')
        "Content-Type": 'application/json'
    }

    fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
        .then((res) => {
            return res.json()
        })
        .then((signs) => {
            console.log('getHoroscope signs', signs);

            return res.status(200).json({
                title: "User details",
                error: false,
                data: signs
            });
        })
}

/*
# parameters: token
# purpose: To get horoscope
*/
const getMatchmaking = async (req, res) => {
    console.log('getMatchmaking req.body ', req.body);

    const result = validationResult(req);
    console.log('getMatchmaking errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    var male_date = new Date(req.body.male_date)
    var female_date = new Date(req.body.female_date)

    console.log('getMatchmaking male_date-- ', male_date, female_date)
    console.log('getMatchmaking -- ', male_date.getMonth(), male_date.getDate(), male_date.getFullYear(), male_date.getHours(), male_date.getMinutes());

    let url = "https://json.astrologyapi.com/v1/match_ashtakoot_points"
    var data = { m_day: male_date.getDate(), m_month: male_date.getMonth() + 1, m_year: male_date.getFullYear(), m_hour: male_date.getHours(), m_min: male_date.getMinutes(), m_lat: req.body.m_lat, m_lon: req.body.m_lon, m_tzone: 5.5, f_day: female_date.getDate(), f_month: female_date.getMonth() + 1, f_year: female_date.getFullYear(), f_hour: female_date.getHours(), f_min: female_date.getMinutes(), f_lat: req.body.f_lat, f_lon: req.body.f_lon, f_tzone: 5.5 }

    console.log('getMatchmaking data', data);

    const headers = {
        "authorization": "Basic " + Buffer.from(process.env.userId + ":" + process.env.apiKey).toString('base64'),
        "Content-Type": 'application/json'
    }

    fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
        .then((res) => {
            return res.json()
        })
        .then((signs) => {
            console.log('getMatchmaking signs', signs);

            signs["conclusion"]["total"] = signs["total"]
            delete signs["total"]
            return res.status(200).json({
                title: "Match making details",
                error: false,
                data: signs
            });
        })
}

/*
# parameters: token
# purpose: To get kundali
*/
const getKundali = async (req, res) => {
    console.log('getKundali req.body ', req.body);

    const result = validationResult(req);
    console.log('getKundali errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    var male_date = new Date(req.body.male_date)

    console.log('getMatchmaking male_date-- ', male_date)
    console.log('getMatchmaking -- ', male_date.getMonth(), male_date.getDate(), male_date.getFullYear(), male_date.getHours(), male_date.getMinutes());

    var svgArr = []
    async.waterfall([
        function (callback) {
            let url = "https://json.astrologyapi.com/v1/horo_chart_image/D1"
            var data = { day: male_date.getDate(), month: male_date.getMonth() + 1, year: male_date.getFullYear(), hour: male_date.getHours(), min: male_date.getMinutes(), lat: req.body.m_lat, lon: req.body.m_lon, tzone: 5.5 };

            const headers = {
                "authorization": "Basic " + Buffer.from(process.env.userId + ":" + process.env.apiKey).toString('base64'),
                "Content-Type": 'application/json'
            }

            fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
                .then((res) => {
                    return res.json()
                })
                .then((signs) => {
                    console.log('getKundali lagna signs', signs);
                    if (signs["status"] == false) {
                        return callback(signs["msg"], []);
                    }
                    let svg = signs["svg"].replace(/\\/g, '')
                    console.log('getKundali lagna svg', svg);

                    svgArr.push({ "lagna": signs["svg"] })
                    return callback(null);
                })
        },
        function (callback) {
            let url = "https://json.astrologyapi.com/v1/horo_chart_image/chalit"
            var data = { day: male_date.getDate(), month: male_date.getMonth() + 1, year: male_date.getFullYear(), hour: male_date.getHours(), min: male_date.getMinutes(), lat: req.body.m_lat, lon: req.body.m_lon, tzone: 5.5 };

            const headers = {
                "authorization": "Basic " + Buffer.from(process.env.userId + ":" + process.env.apiKey).toString('base64'),
                "Content-Type": 'application/json'
            }

            fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
                .then((res) => {
                    return res.json()
                })
                .then((signs) => {
                    console.log('getKundali chalit signs', signs);
                    /*
                    if (signs["status"] == false) {
                        return callback(signs["msg"], []);
                    }
                    let svg = signs["svg"].replace(/\\/g, '')
                    console.log('getKundali chalit svg', svg);

                    svgArr.push({ "chalit": signs["svg"] })*/
                    svgArr.push({ "chalit": signs })

                    return callback(null);
                })
        },
        function (callback) {
            console.log('getKundali Navamansha signs', svgArr.length);

            let url = "https://json.astrologyapi.com/v1/horo_chart_image/D9"
            var data = { day: male_date.getDate(), month: male_date.getMonth() + 1, year: male_date.getFullYear(), hour: male_date.getHours(), min: male_date.getMinutes(), lat: req.body.m_lat, lon: req.body.m_lon, tzone: 5.5 };

            const headers = {
                "authorization": "Basic " + Buffer.from(process.env.userId + ":" + process.env.apiKey).toString('base64'),
                "Content-Type": 'application/json'
            }

            fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
                .then((res) => {
                    return res.json()
                })
                .then((signs) => {
                    console.log('getKundali Navamansha signs', signs);
                    if (signs["status"] == false) {
                        return callback(signs["msg"], []);
                    }
                    let svg = signs["svg"].replace(/\\/g, '')
                    console.log('getKundali Navamansha svg', svg);

                    svgArr.push({ "Navamansha": signs["svg"] })
                    return callback(null);
                })
        },
        function (callback) {
            let url = "https://json.astrologyapi.com/v1/horo_chart_image/MOON"
            var data = { day: male_date.getDate(), month: male_date.getMonth() + 1, year: male_date.getFullYear(), hour: male_date.getHours(), min: male_date.getMinutes(), lat: req.body.m_lat, lon: req.body.m_lon, tzone: 5.5 };

            const headers = {
                "authorization": "Basic " + Buffer.from(process.env.userId + ":" + process.env.apiKey).toString('base64'),
                "Content-Type": 'application/json'
            }

            fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
                .then((res) => {
                    return res.json()
                })
                .then((signs) => {
                    console.log('getKundali Moon signs', signs);
                    if (signs["status"] == false) {
                        return callback(signs["msg"], []);
                    }
                    let svg = signs["svg"].replace(/\\/g, '')
                    console.log('getKundali Moon svg', svg);

                    svgArr.push({ "moon": signs["svg"] })
                    return callback(null, svgArr);
                })
        }
    ], function (err, svgArr) {
        console.log('getKundali func svgArr', err, svgArr);
        //    return res.send(svgArr);
        if (err) {
            return res.status(200).json({
                error: true,
                title: "Something went wrong"
            });
        }
        return res.status(200).json({
            title: "Kundali details",
            error: false,
            data: svgArr
        });
    })
}

/*
# parameters: token
# purpose: To get panchang
*/
const getPanchang = async (req, res) => {
    console.log('getPanchang req.body ', req.body);

    const result = validationResult(req);
    console.log('getPanchang errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    var male_date = new Date(req.body.male_date)

    console.log('getPanchang male_date-- ', male_date)
    console.log('getPanchang -- ', male_date.getMonth(), male_date.getDate(), male_date.getFullYear(), male_date.getHours(), male_date.getMinutes());

    let url = "https://json.astrologyapi.com/v1/basic_panchang/sunrise"
    var data = { day: male_date.getDate(), month: male_date.getMonth() + 1, year: male_date.getFullYear(), hour: male_date.getHours(), min: male_date.getMinutes(), lat: req.body.m_lat, lon: req.body.m_lon, tzone: 5.5 }

    const headers = {
        "authorization": "Basic " + Buffer.from(process.env.userId + ":" + process.env.apiKey).toString('base64'),
        "Content-Type": 'application/json'
    }

    fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
        .then((res) => {
            return res.json()
        })
        .then((signs) => {
            console.log('getHoroscope signs', signs);

            return res.status(200).json({
                title: "Panchang details",
                error: false,
                data: signs
            });
        })
}

/*
# parameters: token
# purpose: To get astrologer rating details
*/
const getAstrologerRatings = async (req, res) => {
    console.log('getAstrologerRatings req.body ', req.body);

    const result = validationResult(req);
    console.log('getAstrologerRatings errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let data = await userModel.getUserRating(req);

    if (data.length == 0) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }
    return res.status(200).json({
        title: "User ratings",
        error: false,
        data: data[0]
    });
}

/*
# parameters: token
# purpose: To subscribe astrologers
*/
const subscribeAstrologer = async (req, res) => {
 
    console.log('subscribeAstrologer req.body ', req.body);
    console.log('subscribeAstrologer req.user ', req.user);

    const result = validationResult(req);

    console.log('subscribeAstrologer errors ', result);

    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    console.log('\n\n\nCheck 1');
    
    let userData = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });

    if (!userData) {
        console.log('\n\n\nCheck 2');
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    if (userData.subscribed_users != undefined) {
        console.log('\n\n\nCheck 3');
     
        let index = userData.subscribed_users.findIndex((e) => e.consumer_id.toString() == req.user._id.toString() && e.service_type == req.body.service_type)
      
        console.log('subscribeAstrologer index---', index)
      
        if (index > -1) {
            console.log('\n\n\nCheck 4');
            userData.subscribed_users[index].date = new Date()
            userData.notified = false
        }
        else {
            console.log('\n\n\nCheck 5');
            userData.subscribed_users.push({
                service_type: req.body.service_type,
                consumer_id: req.user._id,
                date: new Date(),
                notified: false
            })
        }
    }

    else {
        console.log('\n\n\nCheck 6');
        userData.subscribed_users = [{
            service_type: req.body.service_type,
            consumer_id: req.user._id,
            date: new Date(),
            notified: false
        }];
    }

    console.log('\n\n\nCheck 7', JSON.stringify(userData.subscribed_users));

    userData.save((err, savedData) => {
     
        console.log('\n\n\nCheck 8');
        console.log('subscribeAstrologer userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong.',
                error: true
            });
        }

        //send mail to astrologer
        var emailMsg = 'A customer has subscribed to your services. Head over to Astrowize app to find out who. Congratulations on a new subscriber!'
        let mailAstrologer = {
            email: savedData.email,
            subject: 'New subscription on Astrowize',
            body:
                "<p>" +
                "Hello," +
                "<p>" +
                emailMsg +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailAstrologer);

        //notify astrologer about subscription    
        var notifyMsg = 'Ting! A customer has subscribed to your services. Click here to know more.'
        let data = {
            msg: notifyMsg,
            title: "",
            device_token: savedData.device_token,
            data: {
                targetedScreen: 'home',
                message: notifyMsg,
                flag: "Subscribed",
            }
        }
        data.data.user_id = savedData._id
        data.data.sec_user_id = req.user._id

        notificationController.sendNotification(data)

        return res.status(200).json({
            title: "We will alert you if and when this astrologer goes online.",
            error: false,
            data: savedData
        });
    })

}

/*
# parameters: token,
# purpose: get history data for consumer and rate card data for astrologer
*/
const getSummary = async (req, res) => {

    let data = await transModel.getSummaryCount(req)
    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        error: false,
        data: isData ? data[0] : []
    })
}

/*
# parameters: token,
# purpose: edit consumer profile
*/
const editProfile = async (req, res) => {
    console.log('editProfile req.body ', req.body);
    const result = validationResult(req);

    console.log('editProfile errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let reqUser = req.user;
    console.log('editProfile reqUser', reqUser)

    var birth = req.body.date_of_birth ? moment.tz(req.body.date_of_birth, helper.getTimezone()).utc() : ''//new Date(req.body.date_of_birth)

    let sameEmailData = await userModel.getUserFromQuery({ email: req.body.email.trim().toLowerCase(), user_type: reqUser.user_type });
    console.log('editProfile sameEmailData ', sameEmailData);
    if (sameEmailData && (sameEmailData._id.toString() != reqUser._id.toString())) {
        return res.status(200).json({
            title: 'User email already exists',
            error: true
        });
    }

    let sameMobileData = await userModel.getUserFromQuery({ mobile: req.body.mobile, user_type: reqUser.user_type });
    if (sameMobileData && (sameMobileData._id.toString() != reqUser._id.toString())) {
        return res.status(200).json({
            title: 'User mobile already exists',
            error: true
        });
    }

    let signData = req.body.date_of_birth ? await helper.getZodiacSign(new Date(req.body.date_of_birth).getMonth(), new Date(req.body.date_of_birth).getDate()) : ''
    reqUser.first_name = req.body.first_name
    reqUser.last_name = req.body.last_name
    reqUser.email = req.body.email.trim().toLowerCase()
    reqUser.mobile = req.body.mobile

    if (req.body.profile_url && req.body.profile_url != "") {
        console.log('editProfile profile_url ', req.body.profile_url.length)

        let newBase64Str = req.body.profile_url.replace(/(\r\n|\n|\r)/gm, "")
        var matches = newBase64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        console.log('editProfile matches', matches)
        if (!matches || matches.length !== 3) {
            console.log('editProfile matches error')
        }
        else if (req.body.profile_url && req.body.profile_url != "") {
            let dir = './assets/consumers/';

            let tempfileName = helper.base64Upload(dir, req.body.profile_url)
            var fileName = tempfileName + '.jpg';

            reqUser.profile_url = '/consumers/' + tempfileName

            // generate thumbnail
            setTimeout(function () {
                helper.getThumbnail(dir, fileName, tempfileName, function (status) {
                    console.log('editProfile getThumbnail -- ', status);
                });
            }, 2000);
        }
    }
    if (birth) {
        reqUser.date_of_birth = birth//new Date(req.body.date_of_birth)
        reqUser.birth_time = req.body.birth_time
    }

    reqUser.astro_sign = signData._id
    reqUser.gender = req.body.gender

    if (req.body.birth_place) {
        reqUser.birth_place = req.body.birth_place

        if (req.body.longitude && req.body.longitude != "" && req.body.latitude && req.body.latitude != "") {
            reqUser.birth_location = [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
        } else {
            reqUser.birth_location = [0.0, 0.0]
        }
    }

    reqUser.save((err, savedUser) => {
        console.log('editProfile userData save err ', err);

        savedUser
            .populate('languages_spoken')
            .populate('specialities')
            .populate('astro_sign')
            .execPopulate()
            .then(function (userData) {

                return res.status(200).json({
                    title: "Consumer edited successfully",
                    error: false,
                    data: userData
                });
            })
    })
}

/*
# parameters: token,
# purpose: To remove listing flag of consumer
*/
const removeListingFlag = async (req, res) => {
    console.log('removeListingFlag req.body ', req.body);

    userModel.findOneAndUpdate({ _id: req.user._id }, { is_listing: false }, { new: true })
        .exec((err, userData) => {
            if (err) {
                console.log('removeListingFlag userData err==== ', err);
            }
            console.log('removeListingFlag userData ==== ', userData);
            return res.status(200).json({
                title: "User flag removed successfully",
                error: false,
                data: userData
            });
        });
}

/*
# parameters: token,
# purpose: Add wallet balance
*/
const addWalletBalance = async (req, res) => {
    console.log('addWalletBalance req.body ', req.body);
    const result = validationResult(req);

    console.log('addWalletBalance errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let reqUser = req.user;
    console.log('addWalletBalance reqUser', reqUser)

    let userData = await userModel.getUserById({ user_id: reqUser._id });
    console.log('addWalletBalance userData ', userData);
    if (!userData) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }

    //razor pay
    let pay_receipt = randomstring.generate(7);
    var instance = new Razorpay({ key_id: process.env.razor_key_id, key_secret: process.env.razor_key_secret })
    var options = {
        amount: parseInt(parseFloat(req.body.wallet_balance).toFixed(2) * 100),  // amount in the smallest currency unit
        currency: "INR",
        receipt: pay_receipt,
        notes: {
            order_type: 'wallet'
        }
    };
    console.log('options====', options, process.env.razor_key_id, process.env.razor_key_secret, req.body.wallet_balance, parseInt(parseFloat(req.body.wallet_balance).toFixed(2) * 100))
    instance.orders.create(options, function (err, order) {
        console.log('requestService razor instance err', err, order);
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
                razor_err: err
            });
        }
        userData.pay_order_id = order.id
        userData.pay_receipt = order.receipt
        console.log('addWalletBalance userData.wallet_balance', userData.wallet_balance)

        userData.save((err, savedUser) => {
            console.log('addWalletBalance userData save err ', err);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong',
                    error: true
                });
            }

            var data = new Object();
            data = savedUser.toObject({ getters: true })
            data.payAmount = parseFloat(req.body.wallet_balance).toFixed(2)

            return res.status(200).json({
                title: "Balance added successfully",
                error: false,
                data: data
            });
        })
    })
}

/*
test notification
*/
const textNotification = async (req, res) => {
    console.log('textNotification req.body ', req.body);

    var msg = 'Your test notification background'
    let consumerData = {
        msg: msg,
        title: "ff",
        device_token: [req.body.device_token],
        data: {
            message: "background",
            flag: "Testing",
            user_name: "test"
        }
    }

    notificationController.sendNotification(consumerData)

    //notificationController.sendSilentNotification(consumerData)

    return res.status(200).json({
        title: "successfully",
        error: false
    });
}

/*
# parameters: token,
# purpose: get earnings for an astrologer
*/
const getEarningsList = async (req, res) => {
    console.log('getEarningsList req.body ', req.body);

    let data = await transModel.getEarnings(req)

    let isData = data.length == 0 ? false : true

    let percent = isData ? (data[0].current_month && data[0].previous_month) ? ((data[0].current_month.total_amount - data[0].previous_month.total_amount) / data[0].previous_month.total_amount) * 100 : (!data[0].current_month && data[0].previous_month) ? -100 : (data[0].current_month && !data[0].previous_month) ? 100 : 0 : 0

    return res.status(200).json({
        title: "Earnings listing",
        error: false,
        settled_amount: isData ? data[0].settled_amount : 0,
        last_settlement: isData ? (data[0].last_settlement ? data[0].last_settlement.settlement_id : {}) : {},
        earning_amount: isData ? (data[0].current_month ? data[0].current_month.total_amount : 0) : 0,
        data: isData ? data[0].all_data : [],
        growth: parseFloat(percent).toFixed(2),
        total_amount: isData ? data[0].settled_data : 0,
        total_count: isData ? (data[0].all_count ? data[0].all_count.count : 0) : 0
    })
}

/*
# parameters: token,
# purpose: Change rate card
*/
const editRateCard = async (req, res) => {

    console.log('editRateCard req.body ', req.body);

    let reqUser = req.user;
    console.log('editProfile reqUser', reqUser)

    let userData = await userModel.getUserFromQuery({ _id: reqUser._id });
    console.log('\n\n\nUSER DATA', userData)

    var msg = ''
    if (req.body.chat_rate && req.body.chat_rate != 0) {
        msg = msg + 'Chat from ₹' + (reqUser.chat_rate ? parseFloat(reqUser.chat_rate).toFixed(2) : 0) + ' per minute to ₹' + parseFloat(req.body.chat_rate).toFixed(2) + ' per minute. '
        userData.change_chat_rate = parseFloat(req.body.chat_rate).toFixed(2);
    }
    else if (req.body.chat_rate && req.body.chat_rate == 0) {
        msg = msg + 'Chat from ₹' + (reqUser.chat_rate ? parseFloat(reqUser.chat_rate).toFixed(2) : 0) + ' per minute to ₹' + parseFloat(req.body.chat_rate).toFixed(2) + ' per minute. '
        userData.change_chat_rate = parseFloat(req.body.chat_rate).toFixed(2);
    }

    if (req.body.video_rate && req.body.video_rate != 0) {
        msg = msg + 'Video calls from ₹' + (reqUser.video_rate ? parseFloat(reqUser.video_rate).toFixed(2) : 0) + ' per minute to ₹' + parseFloat(req.body.video_rate).toFixed(2) + ' per minute. '
        userData.change_video_rate = parseFloat(req.body.video_rate).toFixed(2);
    }
    else if (req.body.video_rate && req.body.video_rate == 0) {
        msg = msg + 'Video calls from ₹' + (reqUser.video_rate ? parseFloat(reqUser.video_rate).toFixed(2) : 0) + ' per minute to ₹' + parseFloat(req.body.video_rate).toFixed(2) + ' per minute. '
        userData.change_video_rate = parseFloat(req.body.video_rate).toFixed(2);
    }

    if (req.body.audio_rate && req.body.audio_rate != 0) {
        msg = msg + 'Audio calls from ₹' + (reqUser.audio_rate ? parseFloat(reqUser.audio_rate).toFixed(2) : 0) + ' per minute to ₹' + parseFloat(req.body.audio_rate).toFixed(2) + ' per minute. '
        userData.change_audio_rate = parseFloat(req.body.audio_rate).toFixed(2);
    }
    else if (req.body.audio_rate && req.body.audio_rate == 0) {
        msg = msg + 'Audio calls from ₹' + (reqUser.audio_rate ? parseFloat(reqUser.audio_rate).toFixed(2) : 0) + ' per minute to ₹' + parseFloat(req.body.audio_rate).toFixed(2) + ' per minute. '
        userData.change_audio_rate = parseFloat(req.body.audio_rate).toFixed(2);
    }

    if (req.body.report_rate && req.body.report_rate != 0) {
        msg = msg + 'Report from ₹' + (reqUser.report_rate ? parseFloat(reqUser.report_rate).toFixed(2) : 0) + ' to ₹' + parseFloat(req.body.report_rate).toFixed(2)
        userData.change_report_rate = parseFloat(req.body.report_rate).toFixed(2);
    }
    else if (req.body.report_rate && req.body.report_rate == 0) {
        msg = msg + 'Report from ₹' + (reqUser.report_rate ? parseFloat(reqUser.report_rate).toFixed(2) : 0) + ' to ₹' + parseFloat(req.body.report_rate).toFixed(2)
        userData.change_report_rate = parseFloat(req.body.report_rate).toFixed(2);
    }

    let mailData = {
        email: process.env.mail_username,
        subject: 'AstroWize - Rate card change request!',
        body:
            "<p>" +
            "Hello " + "Admin" + "," +
            "<p>" +
            reqUser.first_name + " has requested to change the rates of his " + msg + "Please accept/deny the same. " +
            "<p>" +
            `<a href="${process.env.adminBaseUrl}/admin/astrologer/edit/${reqUser._id}">Click here</a>` +
            "<p>" +
            "Regards," +
            "<br>" +
            "Team AstroWize"
    };
    helper.sendEmail(mailData);

    userData.save((err, savedUser) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }
        else {
            return res.status(200).json({
                title: "Rate request sent successfully",
                error: false
            });
        }
    })

}

/*
# parameters: token,
# purpose: edit astrologer profile
*/
const editAstroProfile = async (req, res) => {
    console.log('editAstroProfile req.body ', req.body);
    const result = validationResult(req);

    console.log('editAstroProfile errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let reqUser = req.user;
    console.log('editAstroProfile reqUser', reqUser)

    let sameEmailData = await userModel.getUserFromQuery({ email: req.body.email.trim().toLowerCase(), user_type: reqUser.user_type });
    console.log('editAstroProfile sameEmailData ', sameEmailData);
    if (sameEmailData && (sameEmailData._id.toString() != reqUser._id.toString())) {
        return res.status(200).json({
            title: 'User email already exists',
            error: true
        });
    }

    let sameMobileData = await userModel.getUserFromQuery({ mobile: req.body.mobile.trim(), user_type: reqUser.user_type });
    console.log('editAstroProfile sameMobileData ', sameMobileData);
    if (sameMobileData && (sameMobileData._id.toString() != reqUser._id.toString())) {
        return res.status(200).json({
            title: 'User mobile already exists',
            error: true
        });
    }

    reqUser.first_name = req.body.first_name
    reqUser.last_name = req.body.last_name
    reqUser.email = req.body.email.trim().toLowerCase()
    reqUser.mobile = req.body.mobile

    reqUser.info = req.body.info
    reqUser.experience_years = req.body.experience_years
    reqUser.languages_spoken = req.body.languages_spoken
    reqUser.specialities = req.body.specialities

    if (req.body.profile_url && req.body.profile_url != "") {
        console.log('editAstroProfile profile_url ', req.body.profile_url.length)

        let newBase64Str = req.body.profile_url.replace(/(\r\n|\n|\r)/gm, "")
        var matches = newBase64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        console.log('editAstroProfile matches', matches)
        if (!matches || matches.length !== 3) {
            console.log('editAstroProfile matches error')
        }
        else if (req.body.profile_url && req.body.profile_url != "") {
            dir = './assets/astrologers/'

            let tempfileName = helper.base64Upload(dir, req.body.profile_url)
            var fileName = tempfileName + '.jpg';
            reqUser.profile_url = '/astrologers/' + tempfileName

            // generate thumbnail
            setTimeout(function () {
                helper.getThumbnail(dir, fileName, tempfileName, function (status) {
                    console.log('editProfile getThumbnail -- ', status);
                });
            }, 2000);
        }
    }

    reqUser.save((err, savedUser) => {
        console.log('editAstroProfile userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong',
                error: true
            });
        }

        savedUser
            .populate('languages_spoken')
            .populate('specialities')
            .populate('astro_sign')
            .execPopulate()
            .then(function (data) {

                return res.status(200).json({
                    title: "Astrologer edited successfully",
                    error: false,
                    data: data
                });
            })
    })
}

/*
# parameters: token,
# purpose: get home page count for astrologer
*/
const getHomePageData = async (req, res) => {
    let data = await transModel.getHomeCountUser(req)
    let isData = data.length == 0 ? false : true

    var newAudioArr = isData ? data[0].newAudio : []
    console.log('getHomePageData newAudioArr--', newAudioArr);

    if (isData && newAudioArr.length > 0) {
        let audioIndex = newAudioArr.findIndex((e) => e._id == 'audio')
        let videoIndex = newAudioArr.findIndex((e) => e._id == 'video')
        if (audioIndex > -1) {
            data[0].data.newAudioCount = newAudioArr[audioIndex].newAudioCount
        }
        else {
            data[0].data.newAudioCount = 0
        }
        if (videoIndex > -1) {
            data[0].data.newVideoCount = newAudioArr[videoIndex].newAudioCount
        }
        else {
            data[0].data.newVideoCount = 0
        }
    }
    //  console.log('getHomePageData data[0].data--', data[0].data);

    return res.status(200).json({
        error: false,
        data: isData ? (data[0].data ? data[0].data : {}) : {}
    })
}

/*
# parameters: 
# purpose: to send sms
*/
const testSMS = async (req, res) => {
    console.log('testSMS req.body ', req.body);

    var smsData = {}


    var url = 'https://astrowize?request_id=' + "5f2d5339c275ee09e7269eca" //'myapplication://deeplink'

    // shorturl(url, function(result) {
    //     console.log("testSMS shorturl" , result);

    var shortUrl = require('node-url-shortener');

    shortUrl.short(url, function (err, shorturl) {
        console.log(shorturl);
        url = shorturl

        console.log('testSMS url ', url);

        var consumerSmsMsg = 'Your service has been assigned to: ' + "eldhose" + "at: john's place" + ' at ' + "20-20-2020 10:20" + '. To confirm please ' + url + ' to pay the remaining amount $20. Thanks, FINOTO.'//'Message from & json api node 1'

        var smsData = {}
        smsData.to = ['919930950590']
        smsData.template_id = "1707161859079565532"
        smsData.message = "Hello " + "eldho" + ", " + consumerSmsMsg

        let sms = helper.sendSMS(smsData)

    });

    return res.status(200).json({
        error: false,
        //    data: sms
    })
}

/*
# parameters: userToken
# Variables used : token
# purpose: to change mobile number for astrologer
*/
const changeMobile = async (req, res) => {
    console.log('changeMobile req', req.body)

    const result = validationResult(req);

    console.log('verifyMobileOTP errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let reqUser = req.user;
    console.log('changeMobile reqUser', reqUser)

    let sameMobileData = await userModel.getUserFromQuery({ mobile: req.body.mobile, user_type: reqUser.user_type });
    console.log('changeMobile sameMobileData ', sameMobileData);
    if (sameMobileData && (sameMobileData._id.toString() != reqUser._id.toString())) {
        return res.status(200).json({
            title: 'User mobile already exists',
            error: true
        });
    }

    var otp = Math.floor(1000 + Math.random() * 9000);
    console.log("changeMobile otp", otp)

    reqUser.otp = otp
    reqUser.otp_expired = Date.now() + 600000; // 10 min

    reqUser.save((err, savedUser) => {
        console.log('changeMobile userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        //email
        let msgBody = otp + " is your One Time Password. Please complete your OTP verification. OTP is Valid for 10 min.";
        let mailData = {
            email: reqUser.email,
            subject: 'Mobile validation',
            body:
                '<p>' + msgBody
        };
        //    helper.sendEmail(mailData)

        //sms
        var smsData = {}
        smsData.to = ['91' + req.body.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160829069812505"
        smsData.message = "Hello " + reqUser.first_name + ", The OTP for your number change request is " + otp + ". Please verify the same to proceed. Thanks, FINOTO."

        let sms = helper.sendSMS(smsData)

        savedUser
            .populate('languages_spoken')
            .populate('specialities')
            .populate('astro_sign')
            .execPopulate()
            .then(function (data) {

                return res.status(200).json({
                    title: "OTP sent successfully",
                    error: false,
                    data: data
                });
            })
    })
}

/*
# parameters: token,
# purpose: verify otp for change mobile
*/
const verifyMobileOTP = async (req, res) => {
    console.log("verifyMobileOTP req.body", req.body);

    const result = validationResult(req);

    console.log('verifyMobileOTP errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let reqUser = req.user;
    console.log('verifyMobileOTP reqUser', reqUser)

    let userData = await userModel.getUserFromQuery({ email: reqUser.email, otp: req.body.verificationOtp, otp_expired: { $gte: Date.now() } });

    console.log("verifyMobileOTP userData", userData);

    if (!userData) {
        return res.status(200).json({
            title: 'OTP entered is not valid or expired',
            error: true
        })
    }

    let sameMobileData = await userModel.getUserFromQuery({ mobile: req.body.mobile, user_type: reqUser.user_type });
    console.log('verifyMobileOTP sameMobileData ', sameMobileData);
    if (sameMobileData && (sameMobileData._id.toString() != reqUser._id.toString())) {
        return res.status(200).json({
            title: 'User mobile already exists',
            error: true
        });
    }

    if (userData._id != "5fe4663334b01e806943538b") {
        userData.otp = undefined;
        userData.otp_expired = undefined;
    }

    userData.isVerifiedPhone = true

    userData.mobile = req.body.mobile
    userData.save((err, savedUser) => {
        console.log('verifyMobileOTP userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        userData
            .populate('languages_spoken')
            .populate('specialities')
            .populate('astro_sign')
            .execPopulate()
            .then(function (data) {

                return res.status(200).json({
                    title: "Otp verified successfully.",
                    error: false,
                    data: data
                });
            })
    })
}

/*
# parameters: token,
# purpose: get all astrologers for admin
*/
const getSupportCatList = async (req, res) => {
    let signs = await supportCategoryModel.getCategories(req, res);

    return res.status(200).json({
        error: false,
        data: signs
    })
}

/*
#parameters:status(offline/online),token
#purpose: To update astrologer status
*/
const updateStatus = async (req, res) => {
    try {
        let data = await userModel.findByIdAndUpdate({ _id: req.user._id }, { $set: { astrologer_status: req.body.status } }).then((result) => result)
        res.status(200).json({
            error: false,
            title: `You are now ${req.body.status} `
        })
    } catch (error) {
        res.status(200).json({
            error: true,
            details: error,
            title: "Facing some issue while saving data"
        })
    }
}

/*
# parameters: token, block_number, building_name, street_address, pincode, user_city, user_state
# purpose: To save consumer's address
*/
const saveConsumerAddress = async (req, res) => {

    const result = validationResult(req);

    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let reqUser = req.user;

    let userAddress = {
        block_number: req.body.block_number,
        building_name: req.body.building_name,
        street_address: req.body.street_address,
        pincode: req.body.pincode,
        user_city: req.body.user_city,
        user_state: req.body.user_state
    }

    reqUser.user_address = userAddress;
    reqUser.shipping_name = req.body.shipping_name;
    reqUser.shipping_number = req.body.shipping_number;

    var options = {
        provider: 'google',
        httpAdapter: 'https',   // Default
        apiKey: process.env.googleapikey,
        formatter: null // 'gpx', 'string', ...
    };
    let geoCoder = nodeGeocoder(options);

    var address = req.body.block_number + ', ' + req.body.building_name + ', ' + req.body.street_address + ', ' + req.body.user_city + ', ' + req.body.user_state
    console.log('saveConsumerAddress address -- ', address, '---', req.body.pincode);

    const geoRes = await geoCoder.geocode({ address: address, country: 'India', zipcode: req.body.pincode })
    // const geoRes = [];
    let geoLocation;

    console.log('saveConsumerAddress Vaikom -- ', geoRes);
    if (geoRes != undefined && geoRes.length > 0) {
        reqUser.user_location = [parseFloat(geoRes[0].longitude), parseFloat(geoRes[0].latitude)]
        geoLocation = [parseFloat(geoRes[0].longitude), parseFloat(geoRes[0].latitude)]
    } else {
        reqUser.user_location = [0.0, 0.0]
        geoLocation = [0.0, 0.0]
    }

    let index = -1;
    if (req.body.address_id) {
        index = reqUser.addresses.findIndex((e) => e._id.toString() == req.body.address_id.toString())
    }

    if (index > -1) {
        reqUser.addresses[index].block_number = req.body.block_number
        reqUser.addresses[index].building_name = req.body.building_name
        reqUser.addresses[index].street_address = req.body.street_address
        reqUser.addresses[index].pincode = req.body.pincode
        reqUser.addresses[index].user_city = req.body.user_city
        reqUser.addresses[index].user_state = req.body.user_state
        reqUser.addresses[index].user_location = geoLocation
        reqUser.addresses[index].shipping_name = req.body.shipping_name
        reqUser.addresses[index].shipping_number = req.body.shipping_number
    }
    else {
        if (!reqUser.addresses) {
            reqUser.addresses = []
        }
        var is_primary = false
        if (reqUser.addresses.length == 0) {
            is_primary = true
        }
        reqUser.addresses.push({
            block_number: req.body.block_number,
            building_name: req.body.building_name,
            street_address: req.body.street_address,
            pincode: req.body.pincode,
            user_city: req.body.user_city,
            user_state: req.body.user_state,
            user_location: geoLocation,
            shipping_name: req.body.shipping_name,
            shipping_number: req.body.shipping_number,
            is_primary: is_primary
        })
    }

    reqUser.save((err, savedUser) => {

        savedUser
            .populate('languages_spoken')
            .populate('specialities')
            .populate('astro_sign')
            .execPopulate()
            .then(function (data) {
                return res.status(200).json({
                    error: false,
                    title: `Address saved successfully`,
                    data: data
                })
            })
    })
}

/*
# parameters: token
# purpose: To delete/primary consumer's address
*/
const deleteConsumerAddress = async (req, res) => {

    const result = validationResult(req);

    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    var titleMsg = "Address deleted successfully"
    let reqUser = req.user;
    let index = -1;
    if (req.body.address_id) {
        index = reqUser.addresses.findIndex((e) => e._id.toString() == req.body.address_id.toString())
    }

    console.log('deleteConsumerAddress index -- ', index);
    if (index > -1) {
        if (req.body.is_primary && (req.body.is_primary == true || req.body.is_primary == "true")) {
            var primaryIndex = reqUser.addresses.findIndex((e) => e.is_primary == true)
            console.log('deleteConsumerAddress primaryIndex -- ', primaryIndex);

            if (primaryIndex > -1) {
                reqUser.addresses[primaryIndex].is_primary = false
            }
            reqUser.addresses[index].is_primary = true
            titleMsg = "Set primary successfully"
        }
        else {
            var deleteAddress = reqUser.addresses[index]
            reqUser.addresses.splice(index, 1);

            console.log('deleteConsumerAddress deleteAddress -- ', deleteAddress);

            if (deleteAddress.is_primary == true && reqUser.addresses.length > 0) {
                reqUser.addresses[0].is_primary = true
            }
        }
    }

    reqUser.save((err, savedUser) => {
        savedUser
            .populate('languages_spoken')
            .populate('specialities')
            .populate('astro_sign')
            .execPopulate()
            .then(function (data) {
                return res.status(200).json({
                    error: false,
                    title: titleMsg,
                    data: data
                })
            })
    })
}

const updateAppNotification = async (req, res) => {

    let astrologers = await userModel.fetchAllAstrologer();

    async.forEach(astrologers, (astrologer, callback) => {

        console.log('\n\nFetch Astrologers', astrologer.email);

        let mailData = {
            email: astrologer.email,
            subject: 'Astrowize - App Update',
            body:
                '<p>' +
                'Hello,' +
                '<p>' +
                'Kindly update the app to enjoy exciting new features!' +
                '<p>' +
                'Regards,' +
                '<br>' +
                'Team AstroWize'
        };

        // helper.sendEmail(mailData);

        callback();
    }, (err) => {
        console.log('Async forEach done');
    });

    return res.status(200).json({
        title: 'Emails Sent Successfully',
    });

}

const updateDeviceToken = async (req, res) => {

    let reqUser = req.user;

    if (req.body.device_token) {
        reqUser.device_token = [req.body.device_token];
    }

    if (req.body.device_type) {
        reqUser.device_type = req.body.device_type;
    }

    reqUser.save((err, savedUser) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update devicedetails.',
                error: true
            });
        }
        return res.status(200).json({
            error: false,
            title: 'Device Token and Type updated successfully',
        });

    })

}

const unSubscribeAstrologer = async (req, res) => {

    console.log('unSubscribeAstrologer req.body ', req.body);
    console.log('unSubscribeAstrologer req.user ', req.user);

    const result = validationResult(req);
    console.log('unSubscribeAstrologer errors ', result);

    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });

    if (!userData) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    let index = userData.subscribed_users.findIndex((e) => e.consumer_id.toString() == req.user._id.toString())

    if (index == -1) {
        return res.status(200).json({
            error: true,
            title: 'You are not subscribed to this Astrologer',
        });
    }

    if (index > -1) {

        let newArr = userData.subscribed_users.filter((e) => { return e.consumer_id.toString() != req.user._id.toString() });
        userData.subscribed_users = newArr;

        userData.save((err, savedData) => {
            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong.',
                    error: true
                });
            }

            return res.status(200).json({
                title: 'Astrologer unsubscribed successfully',
                error: false,
                data: savedData
            });
        })
    }

}

module.exports = {
    signin,
    login,
    changePassword,
    forgotPassword,
    verifyOTP,
    userLogout,
    validateEmail,
    sendTipOfTheDay,
    signup,
    addSupport,
    getTipOfTheDay,
    getHoroscope,
    getAstrologerRatings,
    getMatchmaking,
    getKundali,
    getPanchang,
    subscribeAstrologer,
    getSummary,
    editProfile,
    removeListingFlag,
    addWalletBalance,
    textNotification,
    getEarningsList,
    editRateCard,
    editAstroProfile,
    getHomePageData,
    testSMS,
    changeMobile,
    verifyMobileOTP,
    getSupportCatList,
    updateStatus,
    saveConsumerAddress,
    deleteConsumerAddress,
    updateAppNotification,
    updateDeviceToken,
    unSubscribeAstrologer
}