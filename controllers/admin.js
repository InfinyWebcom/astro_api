/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
const nodeGeocoder = require('node-geocoder');

/* Models */
const languagesModel = require('../models/language');
const specialityModel = require('../models/speciality');
const serviceReqModel = require('../models/serviceRequest');
const userModel = require('../models/user');
const signModel = require('../models/astrosign');
const tipModel = require('../models/tipoftheday');
const ratingModel = require('../models/rating');
const productOrderModel = require('../models/productOrder');
const requestModel = require('../models/serviceRequest');
const reportModel = require('../models/report');
const promotionModel = require('../models/promotion');
const chatModel = require('../models/chat');
const calldetailModel = require('../models/calldetail');
const transModel = require('../models/transaction');
const supportModel = require('../models/support');
const referralModel = require('../models/referral');
const newsModel = require('../models/newsSubscriber');
const contentModel = require('../models/astrocontent');

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');
const CourierService = require('../lib/courierService')
const emailTemplate = require('../lib/emailtemplates');

/*
# parameters: token,
# purpose: login for admin
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

    let userData = await userModel.getAdminUser(req.body);

    console.log('login userData ', userData);

    if (!userData) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }
    if (!bcrypt.compareSync(req.body.password, userData.password)) {
        return res.status(200).json({
            title: 'You have entered an invalid username or password',
            error: true
        });
    }
    if (req.body.device_token) {
        userData.device_token = [req.body.device_token];
    }
    userData.save((err, savedUser) => {
        console.log('login userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }

        userData.isMobile = req.body.device_token ? true : false
        helper.generateToken(userData, (token) => {
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
# purpose: To create astrologer from admin panel
*/
const createAstrologer = async (req, res) => {
    console.log('createAstrologer req.body ', req.body);
    const result = validationResult(req);

    console.log('createAstrologer errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUser(req.body);
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
    var password = randomstring.generate(7);
    var user_address = {
        block_number: req.body.block_number,
        building_name: req.body.building_name,
        street_address: req.body.street_address,
        pincode: req.body.pincode,
        user_city: req.body.user_city,
        user_state: req.body.user_state,
    }

    var newUser = new userModel({
        first_name: req.body.first_name,
        //    last_name: req.body.last_name,
        email: req.body.email.trim().toLowerCase(),
        user_type: req.body.user_type,
        mobile: req.body.mobile,
        info: req.body.info,
        password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
        experience_years: req.body.experience_years,
        unique_name: password,
        languages_spoken: req.body.languages_spoken,
        specialities: req.body.specialities,
        user_address: user_address,
        //    user_location: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)],
        chat_rate: (!req.body.chat_rate || req.body.chat_rate == "") ? undefined : parseFloat(req.body.chat_rate).toFixed(2),
        video_rate: (!req.body.video_rate || req.body.video_rate == "") ? undefined : parseFloat(req.body.video_rate).toFixed(2),
        audio_rate: (!req.body.audio_rate || req.body.audio_rate == "") ? undefined : parseFloat(req.body.audio_rate).toFixed(2),
        report_rate: (!req.body.report_rate || req.body.report_rate == "") ? undefined : parseFloat(req.body.report_rate).toFixed(2),
        client_chat_rate: (!req.body.client_chat_rate || req.body.client_chat_rate == "") ? undefined : parseFloat(req.body.client_chat_rate).toFixed(2),
        client_video_rate: (!req.body.client_video_rate || req.body.client_video_rate == "") ? undefined : parseFloat(req.body.client_video_rate).toFixed(2),
        client_audio_rate: (!req.body.client_audio_rate || req.body.client_audio_rate == "") ? undefined : parseFloat(req.body.client_audio_rate).toFixed(2),
        client_report_rate: (!req.body.client_report_rate || req.body.client_report_rate == "") ? undefined : parseFloat(req.body.client_report_rate).toFixed(2),
        is_chat: req.body.is_chat,
        is_video: req.body.is_video,
        is_audio: req.body.is_audio,
        is_report: req.body.is_report,
        astrologer_status: "online",
        background_color: helper.randomDarkColor(),
        added_from: "admin"
    })

    //to add profile image
    if (req.body.profile_url && req.body.profile_url != "") {
        console.log('createAstrologer req.body', req.body.profile_url.length)

        let newBase64Str = req.body.profile_url.replace(/(\r\n|\n|\r)/gm, "")
        var matches = newBase64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        console.log('createAstrologer matches', matches)
        if (!matches || matches.length !== 3) {
            console.log('createAstrologer matches error')
        }
        else if (req.body.profile_url && req.body.profile_url != "") {
            let dir = './assets/astrologers/';
            let tempfileName = helper.base64Upload(dir, req.body.profile_url)
            var fileName = tempfileName + '.jpg';
            newUser.profile_url = '/astrologers/' + tempfileName

            // generate thumbnail
            setTimeout(function () {
                helper.getThumbnail(dir, fileName, tempfileName, function (status) {
                    console.log('createAstrologer getThumbnail -- ', status);
                });
            }, 2000);
        }
    }

    //referral code 
    var referral_code = randomstring.generate(5);
    newUser.referral_code = referral_code
    let refUser = await userModel.getUserFromQuery({ referral_code: referral_code });

    if (refUser) {
        newUser.referral_code = randomstring.generate(5);
    }

    var options = {
        provider: 'google',
        httpAdapter: 'https',   // Default
        apiKey: process.env.googleapikey,
        formatter: null // 'gpx', 'string', ...
    };
    let geoCoder = nodeGeocoder(options);

    var address = req.body.block_number + ', ' + req.body.building_name + ', ' + req.body.street_address + ', ' + req.body.user_city + ', ' + req.body.user_state
    console.log('createAstrologer address -- ', address, '---', req.body.pincode);

    const geoRes = await geoCoder.geocode({ address: address, country: 'India', zipcode: req.body.pincode })
    console.log('nodeGeocoder Vaikom -- ', geoRes);
    if (geoRes != undefined && geoRes.length > 0) {
        newUser.user_location = [parseFloat(geoRes[0].longitude), parseFloat(geoRes[0].latitude)]
    } else {
        newUser.user_location = [0.0, 0.0]
    }

    helper.getPermissionGroupId("Astrologer", (err, groupData) => {
        console.log('createAstrologer getPermissionGroupId ', err);
        if (err) {
            return res.status(200).json({
                title: "Something went wrong please try again.",
                error: true,
            });
        } else {
            newUser.groupId = groupData._id
        }
        /*
        //send mail
        var variableDetails = {
            name: req.body.first_name,
            message1: "Thank you for registering on Astrowize!.",
            message2: "Your password is: " + password
        };
        var html = helper.renderMessageFromTemplateAndVariables(emailTemplate.notificationMessages.commmon.email, variableDetails)
        let mailData = {
            email: newUser.email,
            subject: 'Welcome To AstroWize',
            body: html
        };        
        helper.sendEmail(mailData, function (status, detail) {
            console.log("Astrologer createde sendMail ", status, detail);
        })
        */
        //mail
        let mailData = {
            email: newUser.email,
            subject: 'Welcome to Astrowize family',
            body:
                "<p>" +
                "Hello " + newUser.first_name + "," +
                "<p>" +
                "Welcome aboard! We are excited for you to be a part of AstroWize  family. Thank you." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };

        helper.sendEmail(mailData)

        //sms
        var smsData = {}
        smsData.to = ['91' + newUser.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828745440060"
        smsData.message = "Hello " + newUser.first_name + ",\nWelcome aboard! We are excited for you to be a part of AstroWize family. Click here to rate our app on Playstore. Thanks, FINOTO"
        let sms = helper.sendSMS(smsData)

        newUser.save((err, savedUser) => {
            console.log('createAstrologer userData save err ', err);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to save user details.',
                    error: true
                });
            }
            return res.status(200).json({
                title: "Astrologer created successfully",
                error: false,
                data: savedUser
            });
        })
    })
}

/*
# parameters: token
# purpose: To edit astrologer from admin panel
*/
const editAstrologer = async (req, res) => {
    console.log('editAstrologer req.body ', req.body);

    const result = validationResult(req);
    console.log('editAstrologer errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserById(req.body);
    console.log('editAstrologer userData ', userData);
    if (!userData) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }
    console.log('editAstrologer userData ', userData);

    let sameEmailData = await userModel.getUserFromQuery({ email: req.body.email.trim().toLowerCase(), user_type: userData.user_type });
    console.log('editAstrologer sameEmailData ', sameEmailData);
    if (sameEmailData && (sameEmailData._id.toString() != userData._id.toString())) {
        return res.status(200).json({
            title: 'User email already exists',
            error: true
        });
    }

    let sameMobileData = await userModel.getUserFromQuery({ mobile: req.body.mobile, user_type: userData.user_type });
    console.log('editAstrologer sameMobileData ', sameMobileData);
    if (sameMobileData && (sameMobileData._id.toString() != userData._id.toString())) {
        return res.status(200).json({
            title: 'User mobile already exists',
            error: true
        });
    }
    if (userData.approval_status !== 'approved') {
        let mailData = {
            email: req.body.email,
            subject: 'Welcome to Astrowize family',
            body:
                "<p>" +
                "Hello " + userData.first_name + "," +
                "<p>" +
                "Welcome aboard! You have been approved by admin. We are excited for you to be a part of Astrowize family. Thank you." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData);
    }
    var is_rate_edited = false
    if (userData.chat_rate != req.body.chat_rate || userData.video_rate != req.body.video_rate || userData.audio_rate != req.body.audio_rate || userData.report_rate != req.body.report_rate) {
        is_rate_edited = true
    }

    if ((userData.is_chat != req.body.is_chat) || (req.body.chat_rate != undefined && req.body.chat_rate != '' && userData.change_chat_rate != '' && userData.change_chat_rate != undefined)) {
        console.log('\n\nTESTING 1', userData.chat_rate, req.body.chat_rate);
        userData.change_chat_rate = undefined;
    }
    if ((userData.is_video != req.body.is_video) || (req.body.video_rate != undefined && req.body.video_rate != '' && userData.change_video_rate != '' && userData.change_video_rate != undefined)) {
        console.log('\n\nTESTING 2', userData.video_rate, req.body.video_rate);
        userData.change_video_rate = undefined;
    }
    if ((userData.is_audio != req.body.is_audio) || (req.body.audio_rate != undefined && req.body.audio_rate != '' && userData.change_audio_rate != '' && userData.change_audio_rate != undefined)) {
        console.log('\n\nTESTING 3', userData.audio_rate, req.body.audio_rate);
        userData.change_audio_rate = undefined;
    }
    if ((userData.is_report != req.body.is_report) || (req.body.report_rate != undefined && req.body.report_rate != '' && userData.change_report_rate != '' && userData.change_report_rate != undefined)) {
        console.log('\n\nTESTING 4', userData.report_rate, req.body.report_rate);
        userData.change_report_rate = undefined;
    }

    var user_address = {
        block_number: req.body.block_number,
        building_name: req.body.building_name,
        street_address: req.body.street_address,
        pincode: req.body.pincode,
        user_city: req.body.user_city,
        user_state: req.body.user_state,
    }
    userData.first_name = req.body.first_name
    // userData.last_name = req.body.last_name
    userData.email = req.body.email.trim().toLowerCase()
    userData.user_type = req.body.user_type
    userData.mobile = req.body.mobile
    userData.info = req.body.info
    userData.experience_years = req.body.experience_years
    userData.languages_spoken = req.body.languages_spoken
    userData.specialities = req.body.specialities
    userData.user_address = user_address
    if (req.body.longitude && req.body.longitude != "") {
        userData.user_location = [parseFloat(req.body.longitude), parseFloat(req.body.latitude)]
    }
    userData.chat_rate = (!req.body.chat_rate || req.body.chat_rate == "") ? undefined : parseFloat(req.body.chat_rate).toFixed(2),
        userData.video_rate = (!req.body.video_rate || req.body.video_rate == "") ? undefined : parseFloat(req.body.video_rate).toFixed(2),
        userData.audio_rate = (!req.body.audio_rate || req.body.audio_rate == "") ? undefined : parseFloat(req.body.audio_rate).toFixed(2),
        userData.report_rate = (!req.body.report_rate || req.body.report_rate == "") ? undefined : parseFloat(req.body.report_rate).toFixed(2),
        userData.client_chat_rate = (!req.body.client_chat_rate || req.body.client_chat_rate == "") ? undefined : parseFloat(req.body.client_chat_rate).toFixed(2),
        userData.client_video_rate = (!req.body.client_video_rate || req.body.client_video_rate == "") ? undefined : parseFloat(req.body.client_video_rate).toFixed(2),
        userData.client_audio_rate = (!req.body.client_audio_rate || req.body.client_audio_rate == "") ? undefined : parseFloat(req.body.client_audio_rate).toFixed(2),
        userData.client_report_rate = (!req.body.client_report_rate || req.body.client_report_rate == "") ? undefined : parseFloat(req.body.client_report_rate).toFixed(2),
        userData.is_chat = req.body.is_chat
    userData.is_video = req.body.is_video
    userData.is_audio = req.body.is_audio
    userData.is_report = req.body.is_report

    userData.approval_status = "approved"

    //geocoder
    var options = {
        provider: 'google',
        httpAdapter: 'https',   // Default
        apiKey: process.env.googleapikey,
        formatter: null // 'gpx', 'string', ...
    };
    let geoCoder = nodeGeocoder(options);

    var address = req.body.block_number + ', ' + req.body.building_name + ', ' + req.body.street_address + ', ' + req.body.user_city + ', ' + req.body.user_state
    console.log('editAstrologer address -- ', address, '---', req.body.pincode);

    const geoRes = await geoCoder.geocode({ address: address, country: 'India', zipcode: req.body.pincode })
    // const geoRes = [];
    console.log('editAstrologer nodeGeocoder Vaikom -- ', geoRes);
    if (geoRes != undefined && geoRes.length > 0) {
        userData.user_location = [parseFloat(geoRes[0].longitude), parseFloat(geoRes[0].latitude)]
    }
    else {
        userData.user_location = [0.0, 0.0]
    }

    //to edit profile image
    if (req.body.profile_url && req.body.profile_url != "") {
        console.log('editAstrologer req.body', req.body.profile_url.length)

        let newBase64Str = req.body.profile_url.replace(/(\r\n|\n|\r)/gm, "")
        var matches = newBase64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        console.log('editProduct matches', matches)
        if (!matches || matches.length !== 3) {
            console.log('editProduct matches error')
        }
        else if (req.body.profile_url && req.body.profile_url != "") {
            if (userData.profile_url && userData.profile_url.length > 0) {
                var oldImage = './assets' + userData.profile_url + '.jpg';
                var oldSmallImage = './assets' + userData.profile_url + '_small.jpg';
                var oldMedImage = './assets' + userData.profile_url + '_medium.jpg';
                helper.unlinkFile(oldImage);
                helper.unlinkFile(oldSmallImage);
                helper.unlinkFile(oldMedImage);
            }
            let dir = './assets/astrologers/';
            let tempfileName = helper.base64Upload(dir, req.body.profile_url)
            var fileName = tempfileName + '.jpg';
            userData.profile_url = '/astrologers/' + tempfileName

            // generate thumbnail
            setTimeout(function () {
                helper.getThumbnail(dir, fileName, tempfileName, function (status) {
                    console.log('addService getThumbnail -- ', status);
                });
            }, 2000);
        }
    }

    userData.save((err, savedUser) => {
        console.log('editAstrologer userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong',
                error: true
            });
        }

        if (is_rate_edited) {
            //mail to astrologer
            let mailData = {
                email: userData.email,
                subject: 'Revised rates on Astrowize',
                body:
                    "<p>" +
                    "Hello " + userData.first_name + "," +
                    "<p>" +
                    "Your rates have been edited by the admin. See more details on Astrowize app. " +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData);

            //notification to astrologer
            var msg = 'Rate Alert! Admin has edited your per minute rate. Click here to know more.'
            let astroData = {
                msg: msg,
                title: "",
                device_token: userData.device_token,
                data: {
                    message: msg,
                    targetedScreen: 'rate_card',
                    flag: "Rate Changed"
                }
            }
            astroData.data.user_id = userData._id
            notificationController.sendNotification(astroData)
        }

        return res.status(200).json({
            title: "Astrologer edited successfully",
            error: false,
            data: savedUser
        });
    })

}

/*
# parameters: token
# purpose: To delete user
*/
const deleteUser = async (req, res) => {
    console.log('deleteUser req.body ', req.body);

    const result = validationResult(req);
    console.log('deleteUser errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserById(req.body);

    if (!userData) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }

    userData.is_deleted = true
    userData.save((err, savedUser) => {
        console.log('deleteUser userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }
        return res.status(200).json({
            title: "Astrologer deleted successfully",
            error: false,
            data: savedUser
        });
    })
}

/*
# parameters: token
# purpose: To upload astrologer's certifications
*/
const uploadCertifications = async (req, res) => {
    console.log('uploadCertifications req.body ', req.body);

    let userData = await userModel.getUserById(req.body);

    if (!userData) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }

    let dir = './assets/certifications/';

    userData.certifications = []

    async.forEach(req.body.certs, (cert, callback) => {
        if (cert.certificate.length > 100) {
            var cert = {
                title: cert.title,
                cert_date: new Date(cert.cert_date),
                certificate: helper.base64Upload(dir, cert.certificate)
            }
            userData.certifications.push(cert)
        } else {
            var cert = {
                title: cert.title,
                cert_date: new Date(cert.cert_date),
                certificate: cert.certificate
            }
            userData.certifications.push(cert)
        }
        callback();
    }, function (err) {
        console.log('async forEach done');

        userData.save((err, savedUser) => {
            console.log('deleteUser userData save err ', err);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to update user details.',
                    error: true
                });
            }
            return res.status(200).json({
                title: "Certifications added successfully",
                error: false,
                data: savedUser
            });
        })
    });
}

/*
# parameters: token
# purpose: get all languages
*/
const getLanguagesList = async (req, res) => {
    let language = await languagesModel.getLanguages();

    return res.status(200).json({
        error: false,
        data: language
    })
}

/*
# parameters: token
# purpose: get all specialities
*/
const getSpecialitiesList = async (req, res) => {
    let speciality = await specialityModel.getSpecialities();

    return res.status(200).json({
        error: false,
        data: speciality
    })
}

/*
# parameters: token,
# purpose: get all astrologers for admin
*/
const getAstrologerList = async (req, res) => {
    console.log('getAstrologerList req.body ', req.body);

    let data = await userModel.getAllAstrologer(req);

    console.log('getAstrologerList astrologers ', data);
    if (req.user && req.user.user_type == "consumer") {
        req.user.is_listing = true

        req.user.save();
    }

    if (data.length > 0) {
        return res.status(200).json({
            title: 'Astrologers listing',
            error: false,
            data: data[0].data,
            total_count: data[0].totalCount,
            wallet_balance: req.user ? req.user.wallet_balance ? req.user.wallet_balance : 0 : 0
        });
    }
    return res.status(200).json({
        title: 'Astrologers listing',
        error: false,
        data: data,
        wallet_balance: req.user ? req.user.wallet_balance ? req.user.wallet_balance : 0 : 0
    });
}

/*
# parameters: token,
# purpose: get all astrologers for admin
*/
const getAstroSignsList = async (req, res) => {
    let signs = await signModel.getAstroSigns();

    return res.status(200).json({
        error: false,
        data: signs
    })
}

/*
# parameters: token,
# purpose: add astro sign for admin
*/
const addAstroSign = async (req, res) => {
    signModel.addSign(req, (err, signData) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update sign details.',
                error: true
            });
        }

        return res.status(200).json({
            title: "Sign saved successfully",
            error: false,
            data: signData
        });
    })
}

/*
# parameters: token
# purpose: add tip of the day
*/
const addTipOfTheDay = async (req, res) => {
    tipModel.addTip(req, (err, tipData) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update tip details.',
                error: true,
                err: tipData
            });
        }

        return res.status(200).json({
            title: "Tip saved successfully",
            error: false,
            data: tipData
        });
    })
}

/*
# parameters: token
# purpose: get tip of the date sent by user
*/
const getTipOfTheDay = async (req, res) => {
    tipModel.getTip(req.body, async (err, tipData) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update tip details.',
                error: true
            });
        }

        console.log('getTipOfTheDay tipData -- ', tipData);
        var tipObj = {}

        if (!tipData || tipData.length == 0) {
            var tip = []
            tipObj.tip_date = new Date(req.body.tip_date)

            let signs = await signModel.getAstroSigns();

            signs.forEach(sign => {
                var arrObj = {}
                arrObj.sign = sign
                arrObj.description = ''

                tip.push(arrObj)
            });
            tipObj.tip = tip

            tipData = tipObj
        }

        return res.status(200).json({
            title: "Tip Details",
            error: false,
            data: tipData
        });
    })
}

/*
# parameters: token
# purpose: get all tips tip of the day
*/
const getAllTips = async (req, res) => {
    tipModel.getAllTip(req.body, async (err, tipData) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update tip details.',
                error: true,
                err: tipData
            });
        }
        if (!tipData) {
            return res.status(200).json({
                title: "Tip Details",
                error: false,
                data: []
            });
        }

        console.log('getAllTips tipData -- ', tipData.length);

        return res.status(200).json({
            title: "Tip Details",
            error: false,
            data: tipData
        });
    })
}

/*
# parameters: token
# purpose: To get user details
*/
const getUserDetails = async (req, res) => {
    console.log('getUserDetails req.body ', req.body);

    const result = validationResult(req);
    console.log('getUserDetails errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let data = await userModel.getUserData(req);

    if (data.length == 0) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }
    return res.status(200).json({
        title: "User details",
        error: false,
        data: data[0]
    });
}

/*
# parameters: token
# purpose: get rating of the user for admin
*/
const getUserRatings = async (req, res) => {
    const result = validationResult(req);
    console.log('getUserRating errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let ratingData = await ratingModel.getRatings(req.body);
    let count = await ratingModel.getRatingsCount(req.body);
    let userData = await userModel.getUserById(req.body);

    return res.status(200).json({
        title: "Ratings List",
        error: false,
        data: ratingData,
        total_count: count,
        astrologer_name: userData.first_name
    });
}

/*
# parameters: token, rating_id
# purpose: delete rating
*/
const deleteRating = async (req, res) => {
    let ratingData = await ratingModel.getRatingById(req);

    ratingData.is_deleted = true
    ratingData.save(async (err, rating) => {
        console.log('delete ratingData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update rating details.',
                error: true
            });
        }

        return res.status(200).json({
            title: "Rating deleted successfully",
            error: false,
            data: rating
        });
    })
}

/*
# parameters: token,
# purpose: get all consumers for admin
*/
const getConsumerList = async (req, res) => {

    console.log('getConsumerList req.body ', req.body);
    let consumers = await userModel.getAllConsumers(req);

    req.body.user_type = 'consumer'
    // let userCount = await userModel.getUserCount(req);
    // console.log('getConsumerList userCount ', userCount);
    // return res.status(200).json({
    //     error: false,
    //     data: consumers,
    //     total_count: userCount
    // })

    if (consumers.length > 0) {
        return res.status(200).json({
            title: 'Consumer listing',
            error: false,
            data: consumers[0].data,
            total_count: consumers[0].totalCount,
        });
    }
    return res.status(200).json({
        title: 'Consumer listing',
        error: false,
        data: consumers,
    });

}

/*
# parameters: token
# purpose: To block user
*/
const blockUser = async (req, res) => {
    console.log('blockUser req.body ', req.body);

    const result = validationResult(req);
    console.log('blockUser errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUserById(req.body);

    if (!userData) {
        return res.status(200).json({
            title: 'User not found',
            error: true
        })
    }
    var title = "User blocked successfully"
    if (userData.is_blocked && userData.is_blocked == true) {
        title = "User unblocked successfully"
        userData.is_blocked = false
    }
    else {
        userData.is_blocked = true
    }
    userData.save((err, savedUser) => {
        console.log('deleteUser userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
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
# purpose: get all astrologers for service request accepting functionality
*/
const getUsersList = async (req, res) => {
    let users = await userModel.getUsers();

    return res.status(200).json({
        error: false,
        data: users
    })
}

/*
# parameters: token,
# purpose: get years list since the first entry from mongodb
*/
const getYearList = async (req, res) => {
    if (req.body.type = 'order') {
        let firstOrder = await productOrderModel.getFirstOrder();
        let lastOrder = await productOrderModel.getLastOrder();

        console.log('firstorder --', firstOrder.createdAt, lastOrder.createdAt);

        let first = firstOrder.createdAt.getFullYear()
        let last = lastOrder.createdAt.getFullYear()

        console.log('firstorder first --', first, last);

        var yearArr = []
        var i;
        for (i = first; i <= last; i++) {
            yearArr.push(i)
        }
        console.log('firstorder yearArr --', yearArr);

        return res.status(200).json({
            error: false,
            data: yearArr
        })
    }
    if (req.body.type = 'request') {
        let firstRequest = await requestModel.getFirstRequest();
        let lastRequest = await requestModel.getLastRequest();

        console.log('firstRequest --', firstRequest.createdAt, lastRequest.createdAt);

        let first = firstRequest.createdAt.getFullYear()
        let last = lastRequest.createdAt.getFullYear()

        console.log('lastRequest first --', first, last);

        var yearArr = []
        var i;
        for (i = first; i <= last; i++) {
            yearArr.push(i)
        }
        console.log('lastRequest yearArr --', yearArr);

        return res.status(200).json({
            error: false,
            data: yearArr
        })
    }
}

/*
# parameters: token,
# purpose: change report status
*/
const changeReportStatus = async (req, res) => {
    console.log('changeReportStatus req.body ', req.body);

    const result = validationResult(req);
    console.log('changeReportStatus errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let report = await reportModel.getReportById(req);

    console.log('changeReportStatus report ', report);

    report.report_status = req.body.report_status

    var res_title = 'Report approved successfully'
    if (req.body.report_status == "Approved") {
        //to consumer
        var msg = 'Report updated! The report you ordered is updated. Click here to download.'
        let consumerData = {
            msg: msg,
            title: "",
            device_token: report.consumer_id.device_token,
            data: {
                targetedScreen: 'report_history',
                message: msg,
                flag: "Report Approved",
                report_url: report.report_url
            }
        }
        consumerData.data.user_id = report.consumer_id._id
        consumerData.data.sec_user_id = report.astrologer_id._id

        notificationController.sendNotification(consumerData)

        //send mail to consumer
        var isPdf = report.report_url.includes(".pdf");
        console.log("Report Download isPdf ", isPdf);
        var url = report.report_url
        if (!isPdf) {
            url = report.report_url + ".jpg"
        }

        let msgBody = 'Your report is ready to download. Click' + '<a href="' + process.env.baseUrl + report.report_url + '">here</a>' + ' to download';
        let mailData = {
            email: report.consumer_id.email,
            subject: 'AstroWize - Report ready!',
            body:
                "<p>" +
                "Hello " + report.consumer_id.first_name + "," +
                "<p>" +
                "This is to inform you that the report you ordered is ready for download." +
                "<p>" +
                "Login to the app and download your report now!" +
                "<p>" +
                "Your current wallet balance is ₹ " + report.consumer_id.wallet_balance + "." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData)

        //to astrologer
        var astrologerMsg = 'Uh-oh! The Admin has approved your report uploaded for ' + report.consumer_id.first_name
        let astrologerData = {
            msg: astrologerMsg,
            title: "",
            device_token: report.astrologer_id.device_token,
            data: {
                targetedScreen: 'report_listing',
                message: astrologerMsg,
                flag: "Report Approved",
            }
        }
        astrologerData.data.user_id = report.astrologer_id._id
        astrologerData.data.sec_user_id = report.consumer_id._id
        notificationController.sendNotification(astrologerData)

        //send mail to astrologer
        let astrologerMailData = {
            email: report.astrologer_id.email,
            subject: 'AstroWize - Report approved!',
            body:
                "<p>" +
                "Hello " + report.astrologer_id.first_name + "," +
                "<p>" +
                "The Admin has approved your report uploaded for " + report.consumer_id.first_name +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(astrologerMailData)

        /*
        var variableDetails = {
            name: report.consumer_id.first_name,
            message1: "Your report is ready to download.",
            message2: 'Click below to download',
            button_link: process.env.baseUrl + url
        };
        var html = helper.renderMessageFromTemplateAndVariables(emailTemplate.notificationMessages.common_button.email, variableDetails)

        let mailData = {
            email: report.consumer_id.email,
            subject: 'Report Download',
            body: html
        };
        
        helper.sendEmail(mailData, function (status, detail) {
            console.log("Report Download sendMail ", status, detail);
        })*/
    }
    if (req.body.report_status == "Rejected") {
        res_title = 'Report denied successfully'

        //to astrologer
        var msg = 'Uh-oh! The Admin has denied your report uploaded for ' + report.consumer_id.first_name
        let astrologerData = {
            msg: msg,
            title: "",
            device_token: report.astrologer_id.device_token,
            data: {
                targetedScreen: 'report_listing',
                message: msg,
                flag: "Report Denied",
            }
        }
        astrologerData.data.user_id = report.astrologer_id._id
        astrologerData.data.sec_user_id = report.consumer_id._id

        notificationController.sendNotification(astrologerData)

        //send mail to astrologer
        let mailData = {
            email: report.astrologer_id.email,
            subject: 'Report Denied',
            body:
                "<p>" +
                "Hello " + report.astrologer_id.first_name + "," +
                "<p>" +
                "The Admin has denied your report uploaded for " + report.consumer_id.first_name +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData)
    }

    report.save((err, savedData) => {
        console.log('deleteUser userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update user details.',
                error: true
            });
        }
        return res.status(200).json({
            title: res_title,
            error: false,
            data: savedData
        });
    })
}

/*
# parameters: token,
# purpose: get all reports listing
*/
const getReportList = async (req, res) => {

    req.body.api_name = 'getReportList'
    let data = await reportModel.getReports(req);
    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: 'Report listing',
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    });
}

/*
# parameters: token,
# purpose: add promotion
*/
const addPromotion = async (req, res) => {
    console.log('addPromotion req.body ', req.body);

    const result = validationResult(req);
    console.log('addPromotion errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    var newPromotion = new promotionModel({
        description: req.body.description,
        user_type: req.body.user_type
    })
    newPromotion.save(async (err, savedData) => {
        console.log('addPromotion userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong.',
                error: true
            });
        }

        let data = await userModel.getUsersByType(req);

        data.forEach(userData => {

            //send mail
            let mailData = {
                email: userData.email,
                subject: 'Message from Astrowize admin',
                body:
                    "<p>" +
                    "Hello " + userData.first_name + "," +
                    "<p>" +
                    "The admin has an important message for you. (" + req.body.description + ")" +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData)

            /*
            var variableDetails = {
                name: userData.first_name,
                message1: "Admin added promotion",
                message2: req.body.description
            };
            var html = helper.renderMessageFromTemplateAndVariables(emailTemplate.notificationMessages.common.email, variableDetails)
    
            let mailData = {
                email: userData.email,
                subject: 'Promotion',
                body: html
            };
            
            helper.sendEmail(mailData, function (status, detail) {
                console.log("Promotion sendMail ", status, detail);
            })
            */

            var msg = "Admin Alert! Click here to view an important message from our Admin."
            let data = {
                msg: msg,
                title: "",
                device_token: userData.device_token,
                data: {
                    message: msg,
                    flag: "Promotion",
                }
            }
            data.data.user_id = userData._id
            notificationController.sendNotification(data)
        })

        return res.status(200).json({
            title: "Promotions sent to the " + req.body.user_type + " successfully",
            error: false,
            data: savedData
        });
    })
}

/*
# parameters: token,
# purpose: get all promotions for admin
*/
const getPromotionList = async (req, res) => {
    let promos = await promotionModel.getPromotions(req);
    let count = await promotionModel.getPromoCount(req);

    return res.status(200).json({
        error: false,
        data: promos,
        total_count: count
    })
}

/*
# parameters: token,
# purpose: get report,call, chat count for astrologer, consumer detail page for admin
*/
const getConsultCount = async (req, res) => {
    let data = await transModel.getSummaryCount(req)//getConsulationsCount(req)
    let isData = data.length == 0 ? false : true
    return res.status(200).json({
        error: false,
        chatCount: isData ? data[0].chatCount : 0,
        audioCount: isData ? data[0].audioCount : 0,
        reportCount: isData ? data[0].reportCount : 0,
        videoCount: isData ? data[0].videoCount : 0,
        requestCount: isData ? data[0].requestCount : 0,
    })
}

/*
# parameters: token,
# purpose: get new orders for admin
*/
const getNewOrdersList = async (req, res) => {
    let data = await productOrderModel.getNewOrders(req)

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "New orders listing",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

/*
# parameters: token,
# purpose: get new Service Requests for admin
*/
const getNewServiceRequests = async (req, res) => {
    let data = await serviceReqModel.getNewRequests(req)

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "New requests listing",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

/*
# parameters: token,
# purpose: get new report for admin
*/
const getNewReportList = async (req, res) => {
    let data = await reportModel.getNewReports(req)

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "New reports listing",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

/*
# parameters: token,
# purpose: get consultation count, amount and graph data for dashbaord and settlement
*/
const getAllConsultData = async (req, res) => {
    let currentData = await transModel.getConsulationsCount(req)
    let monthlyData = await transModel.getConsulationsData(req)

    var d = new Date();
    d.setMonth(d.getMonth() - 1);
    console.log('getAllConsultData d', d, d.getMonth(), d.getFullYear());

    req.body.year = d.getFullYear()
    req.body.month = d.getMonth() + 1

    let previousData = await transModel.getConsulationsCount(req)

    var chatPerc = 0
    var audioPerc = 0
    var videoPerc = 0
    var reportPerc = 0
    var requestPerc = 0

    if (currentData.length > 0 && previousData.length > 0) {
        console.log('getAllConsultData d', currentData[0].chatCount, previousData[0].chatCount)

        chatPerc = (currentData[0].chatCount == 0 && previousData[0].chatCount == 0) ? 0 : ((previousData[0].chatCount == 0) ? 0 : ((currentData[0].chatCount - previousData[0].chatCount) / previousData[0].chatCount) * 100)

        audioPerc = (currentData[0].audioCount == 0 && previousData[0].audioCount == 0) ? 0 : ((previousData[0].audioCount == 0) ? 0 : ((currentData[0].audioCount - previousData[0].audioCount) / previousData[0].audioCount) * 100)

        videoPerc = (currentData[0].videoCount == 0 && previousData[0].videoCount == 0) ? 0 : ((previousData[0].videoCount == 0) ? 0 : ((currentData[0].videoCount - previousData[0].videoCount) / previousData[0].videoCount) * 100)

        reportPerc = (currentData[0].reportCount == 0 && previousData[0].reportCount == 0) ? 0 : ((previousData[0].reportCount == 0) ? 0 : ((currentData[0].reportCount - previousData[0].reportCount) / previousData[0].reportCount) * 100)

        requestPerc = (currentData[0].requestCount == 0 && previousData[0].requestCount == 0) ? 0 : ((previousData[0].requestCount == 0) ? 0 : ((currentData[0].requestCount - previousData[0].requestCount) / previousData[0].requestCount) * 100)
    }

    var countData = {
        ...currentData[0],
        chatPerc: chatPerc.toFixed(2),
        audioPerc: audioPerc.toFixed(2),
        videoPerc: videoPerc.toFixed(2),
        reportPerc: reportPerc.toFixed(2),
        requestPerc: requestPerc.toFixed(2)
    }

    return res.status(200).json({
        error: false,
        countData: countData,
        monthlyData: monthlyData
    })
}

/*
# parameters: token,
# purpose: get all support tickets
*/
const getSupportList = async (req, res) => {
    let data = await supportModel.getSupports(req);
    let activeData = await supportModel.getSupportsCount(req);

    console.log('getSupportList activeData ', activeData);

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "Support listing",
        error: false,
        active_count: activeData,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

/*
# parameters: token,
# purpose: get all support tickets
*/
const resolveTicket = async (req, res) => {
    let data = await supportModel.getSupportById(req);

    const result = validationResult(req);
    console.log('resolveTicket errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    data.support_status = "Resolved"
    data.save((err, savedData) => {
        console.log('addPromotion userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong.',
                error: true
            });
        }
        return res.status(200).json({
            title: "Ticket resolved successfully",
            error: false,
            data: savedData
        })
    })
}

/*
# parameters: token,
# purpose: get top selling services
*/
const getTopSellingServices = async (req, res) => {
    let data = await transModel.getTopServices(req);

    return res.status(200).json({
        title: "Top selling services",
        error: false,
        data: data
    })
}

/*
# parameters: token
# purpose: get top selling products
*/
const getTopSellingProducts = async (req, res) => {
    let data = await transModel.getTopProducts(req);

    return res.status(200).json({
        title: "Top selling products",
        error: false,
        data: data
    })
}

/*
# parameters: token
# purpose: get top earning astrologers
*/
const getTopEarnAstrologers = async (req, res) => {
    let data = await transModel.getTopAstrolgers(req);

    return res.status(200).json({
        title: "Top selling products",
        error: false,
        data: data
    })
}

/*
# parameters: token,
# purpose: To add astrologer from home front
*/
const addAstrologer = async (req, res) => {
    console.log('addAstrologer req.body ', req.body);
    const result = validationResult(req);

    console.log('addAstrologer errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let userData = await userModel.getUser(req.body);
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
    var password = randomstring.generate(7);

    var newUser = new userModel({
        first_name: req.body.first_name,
        email: req.body.email.trim().toLowerCase(),
        user_type: req.body.user_type,
        mobile: req.body.mobile,
        password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
        experience_years: req.body.experience_years,
        unique_name: password,
        specialities: req.body.specialities,
        astrologer_status: "online",
        background_color: helper.randomDarkColor(),
        added_from: "home",
        approval_status: "pending"
    })

    //referral code 
    var referral_code = randomstring.generate(5);
    newUser.referral_code = referral_code
    let refUser = await userModel.getUserFromQuery({ referral_code: referral_code });

    if (refUser) {
        newUser.referral_code = randomstring.generate(5);
    }

    helper.getPermissionGroupId("Astrologer", (err, groupData) => {
        console.log('addAstrologer getPermissionGroupId ', err);
        if (err) {
            return res.status(200).json({
                title: "Something went wrong please try again.",
                error: true,
            });
        } else {
            newUser.groupId = groupData._id
        }

        //send mail to admin
        let mailData = {
            email: process.env.mail_username,
            subject: 'AstroWize - New astrologer registration!',
            body:
                "<p>" +
                "Hello " + "Admin" + "," +
                "<p>" +
                newUser.first_name + " has successfully registered as an Astrologer through our website." +
                "<p>" +
                "Please take the necessary action to proceed further." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData);

        /*
        var variableDetails = {
            name: "Admin",
            message1: "New astrologer added from website",
            message2: "Approve astrologer from admin panel."
        };
        var html = helper.renderMessageFromTemplateAndVariables(emailTemplate.notificationMessages.common.email, variableDetails)

        let mailData = {
            email: process.env.mail_username,
            subject: 'Astrologer Registration',
            body: html
        };
        
        helper.sendEmail(mailData, function (status, detail) {
            console.log("addAstrologer sendMail ", status, detail);
        })
        */
        //mail to astrologer
        let adminMailData = {
            email: newUser.email,
            subject: 'Thank you for registering on Astrowize',
            body:
                "<p>" +
                "Hello " + newUser.first_name + "," +
                "<p>" +
                "Thank you for filling AstroWize's onboarding form. Our team will scrutinize the same and update you on further procedure. Please rate your experience. Thank you." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(adminMailData);

        newUser.save(async (err, savedUser) => {
            console.log('addAstrologer userData save err ', err);

            //referral code validation
            if (req.body.referral_code && req.body.referral_code != "") {
                let data = await userModel.getUserCode(req);
                if (data) {
                    referralModel.addReferrals(data, savedUser)

                    //sent message to referror
                    let referMsg = "Astro & Wise! The astrologer you referred has been onboarded on AstroWize. Click here to view their profile."
                    if (data.user_type == "consumer") {
                        referMsg = "Look who's here! " + newUser.first_name + " referred by you has successfully registered as an Astrologer on AtroWize using the referral code " + req.body.referral_code
                    }
                    let notifData = {
                        msg: referMsg,
                        title: "",
                        device_token: data.device_token,
                        data: {
                            targetedScreen: 'astrologer_listing',
                            message: referMsg,
                            flag: "Referral Astrologer",
                        }
                    }
                    notifData.data.user_id = data._id
                    notificationController.sendNotification(notifData)

                    //send mail to referror
                    var mailMsg = newUser.first_name + " whom you referred to Astrowize has registered and created their profile. You can now see their profile on Astrowize app. Thank you."
                    if (data.user_type == "consumer") {
                        mailMsg = newUser.first_name + "referred by you has successfully registered as a user on AstroWize using the referral code " + req.body.referral_code +
                            "<p>" +
                            "You can earn a reward once " + newUser.first_name + " makes his/her first transaction. Keep on referring!"
                    }
                    let referMailData = {
                        email: data.email,
                        subject: 'AstroWize - Astrologer referral registration successful!',
                        body:
                            "<p>" +
                            "Hello " + data.first_name + "," +
                            "<p>" +
                            "Your referred fellow astrologer (name of the referred astrologer) has been onboarded by team Astrowize. You can now view their profile on Astrowize app. Thank you." +
                            "<p>" +
                            "Regards," +
                            "<br>" +
                            "Team AstroWize"
                    };
                    helper.sendEmail(referMailData)
                }
            }

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to save user details.',
                    error: true
                });
            }
            return res.status(200).json({
                title: "Thank you for signing up. You will be notified via email when your registration is approved.",
                error: false,
                data: savedUser
            });
        })
    })
}

const registerAdminToShipRocket = async (req, res) => {
    let body = {
        pickup_location: req.user.unique_name,
        "name": req.user.first_name,
        "email": req.user.email,
        "phone": Number(req.user.mobile),
        "address": req.user.user_address.street_address,
        "city": req.user.user_address.user_city,
        "state": req.user.user_address.user_state,
        "country": "India",
        "pin_code": Number(req.user.user_address.pincode)
    }
    let registered = await CourierService.enableAdminToShipRocket(body)
    res.status(200).json(registered)

}

/*
# parameters: email, name, msg
# purpose: To send mail to admin when user started from home page
*/
const getStartedHome = async (req, res) => {
    console.log('getStartedHome req.body ', req.body);

    const result = validationResult(req);
    console.log('getStartedHome errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let mailData = {
        email: process.env.mail_username,
        subject: 'AstroWize - New inquiry through the Website!',
        body:
            "<p>" +
            "Hello " + "Admin" + "," +
            "<p>" +
            "You have received a new inquiry from " + req.body.name + " asking for an astrology session. Please take required action." +
            "<p>" +
            "Regards," +
            "<br>" +
            "Team AstroWize"
    };
    helper.sendEmail(mailData);
    /*
    //send mail
    var variableDetails = {
        name: "Admin",
        message1: "User registered from home page",
        message2: "Approve astrologer from admin panel."
    };
    var html = helper.renderMessageFromTemplateAndVariables(emailTemplate.notificationMessages.common.email, variableDetails)

    let mailData = {
        email: process.env.mail_username,
        subject: 'User Registered',
        body: html
    };
    
    helper.sendEmail(mailData, function (status, detail) {
        console.log("addAstrologer sendMail ", status, detail);
    })
    */
    return res.status(200).json({
        title: "We have received your message. We'll contact you soon!",
        error: false
    });
}

/*
# parameters: token,
# purpose: To send mail to admin when user started from home page
*/
const subscribeNewsLetter = async (req, res) => {
    console.log('subscribeNewsLetter req.body ', req.body);

    const result = validationResult(req);
    console.log('subscribeNewsLetter errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let newsData = await newsModel.getNewsSubscribers(req);
    if (newsData) {
        return res.status(200).json({
            title: 'You already subscribed for newsletter',
            error: true
        })
    }

    var newLetter = new newsModel({
        email: req.body.email
    })

    newLetter.save((err, savedNews) => {
        console.log('subscribeNewsLetter userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to save user details.',
                error: true
            });
        }
        return res.status(200).json({
            title: "Newsletter subscribed successfully",
            error: false,
            data: savedNews
        });
    })
}

const addContent = async (req, res) => {
    let data = await contentModel.add(req)
    res.status(200).json({
        error: data ? false : true,
        title: data ? 'Content added successfully' : 'Getting error'
    })
}

const getContentByName = async (req, res) => {
    let query = { name: req.body.name }
    let data = await contentModel.findByName(query);
    res.status(200).json({
        error: false,
        data
    })

}

const astrologerList = (req, res) => {
    userModel.find({ user_type: 'astrologer', is_deleted: false }, { _id: 1, first_name: 1 }).sort({ 'first_name': 1 }).then(data => {
        if (data.length > 0) {
            console.log('-=-=astrologerList length-', data.length)
            res.status(200).json({
                title: 'Astrologers listing.',
                error: false,
                data: data
            });
        } else {
            res.status(200).json({
                title: 'Error.',
                error: true,
                data: data
            });
        }
    });
}

const transactionStats = async (req, res) => {
    let data = await transModel.getStats(req);
    res.status(200).json({
        title: 'success',
        error: false,
        data: data.length > 0 ? data[0] : []
    })
}

const getNewStats = async (req, res) => {

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) - 1 : date.getMonth();
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear();

    let start = new Date(year, month, 01);
    let end = new Date(year, month, 30);

    console.log('getNewStats start :', start);
    console.log('getNewStats end :', end);

    let usersActive = await userModel.aggregate([
        {
            $lookup: {
                from: 'calldetails',
                localField: '_id',
                foreignField: 'consumer_id',
                as: 'matched_docs_call'
            }
        },
        {
            $lookup: {
                from: 'chats',
                localField: '_id',
                foreignField: 'consumer_id',
                as: 'matched_docs_chat'
            }
        },
        {
            $match: {
                $or: [
                    { 'matched_docs_call': { $ne: [] } },
                    { 'matched_docs_chat': { $ne: [] } }
                ],
                $and: [
                    { 'matched_docs_call.createdAt': { $gte: start, $lt: end } },
                    { 'matched_docs_chat.createdAt': { $gte: start, $lt: end } }
                ],
            }
        },
        {
            $group: {
                _id: '$_id'
            }
        },
        {
            $group: {
                _id: 1,
                count: { $sum: 1 }
            }
        },
    ]);

    // let usersInactive = await userModel.aggregate([
    //     {
    //         $lookup: {
    //             from: 'calldetails',
    //             localField: '_id',
    //             foreignField: 'consumer_id',
    //             as: 'matched_docs_call'
    //         }
    //     },
    //     {
    //         $lookup: {
    //             from: 'chats',
    //             localField: '_id',
    //             foreignField: 'consumer_id',
    //             as: 'matched_docs_chat'
    //         }
    //     },
    //     {
    //         $match: {
    //             $or: [
    //                 { 'matched_docs_call': { $eq: [] } },
    //                 { 'matched_docs_chat': { $eq: [] } }
    //             ],
    //             // $and: [
    //             //     { 'matched_docs_call.createdAt': { $gte: start, $lt: end } },
    //             //     { 'matched_docs_chat.createdAt': { $gte: start, $lt: end } }
    //             // ],
    //         }
    //     },
    //     {
    //         $group: {
    //             _id: '$_id'
    //         }
    //     },
    //     {
    //         $group: {
    //             _id: 1,
    //             count: { $sum: 1 }
    //         }
    //     },
    // ]);

    let totalUsers = await userModel.find({}).count();

    let missedCalls = await calldetailModel.find({
        $and: [
            { call_rate: 0 },
            { createdAt: { $gte: start } },
            { createdAt: { $lte: end } },
        ]
    }).count();

    let successfullCalls = await calldetailModel.find({
        $and: [
            { call_rate: { $gt: 0 } },
            { createdAt: { $gte: start } },
            { createdAt: { $lte: end } },
        ]
    }).count();

    let consumerCalls = await calldetailModel.aggregate([
        {
            '$group': {
                _id: '$consumer_id',
                count: { $sum: 1 }
            }
        },
        {
            $lookup:
            {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' }
    ]);

    let astrologerCalls = await calldetailModel.aggregate([
        {
            '$group': {
                _id: '$astrologer_id',
                count: { $sum: 1 }
            }
        },
        {
            $lookup:
            {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' }
    ]);

    const userStats = [
        { name: 'Active', value: usersActive.length > 0 ? usersActive[0].count : 0, color: '#19A6D2' },
        { name: 'Inactive', value: usersActive.length > 0 ? totalUsers - usersActive[0].count : totalUsers, color: '#F39711' },
    ];

    const callStats = [
        { name: 'Successfull', value: successfullCalls, color: '#19A6D2' },
        { name: 'Missed', value: missedCalls, color: '#F39711' },
    ];

    res.status(200).json({
        error: false,
        title: 'Success',
        userStats: userStats,
        callStats: callStats,
        consumerCalls: consumerCalls,
        astrologerCalls: astrologerCalls,
    });
}

module.exports = {
    login,
    createAstrologer,
    editAstrologer,
    deleteUser,
    uploadCertifications,
    getLanguagesList,
    getSpecialitiesList,
    getAstrologerList,
    getAstroSignsList,
    addAstroSign,
    addTipOfTheDay,
    getTipOfTheDay,
    getUserDetails,
    getUserRatings,
    deleteRating,
    getConsumerList,
    getAllTips,
    blockUser,
    getUsersList,
    getYearList,
    changeReportStatus,
    getReportList,
    addPromotion,
    getPromotionList,
    getConsultCount,
    getNewOrdersList,
    getNewServiceRequests,
    getNewReportList,
    getAllConsultData,
    getSupportList,
    resolveTicket,
    getTopSellingServices,
    getTopSellingProducts,
    getTopEarnAstrologers,
    addAstrologer,
    registerAdminToShipRocket,
    getStartedHome,
    subscribeNewsLetter,
    addContent,
    getContentByName,
    astrologerList,
    transactionStats,
    getNewStats
}