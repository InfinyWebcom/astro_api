/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
var moment = require('moment');
const Twilio = require('twilio');
const AccessToken = Twilio.jwt.AccessToken;
const nodeSchedule = require('node-schedule');
const request = require('request');

/* Models */
const serviceModel = require('../models/service');
const userModel = require('../models/user');
const requestModel = require('../models/serviceRequest');
const calldetailModel = require('../models/calldetail');
const transModel = require('../models/transaction');
const chatSessionModel = require('../models/chatSession');

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');
const chatController = require('../controllers/chat');

/* GLOBAL CONSTANTS */
const client = new Twilio(process.env.accountSid, process.env.authToken);
const VoiceGrant = AccessToken.VoiceGrant;

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const accessToken = new AccessToken(
    process.env.accountSid,
    process.env.API_KEY_SID,
    process.env.API_KEY_SECRET
);
const VideoGrant = AccessToken.VideoGrant;

/*
# parameters: token
# purpose: To check astrologer status before call
user: consumer
*/
const getAstrologerStatus = async (req, res) => {
    console.log('getAstrologerStatus req.body ', req.body);

    const result = validationResult(req);
    console.log('getAstrologerStatus errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    console.log('getAstrologerStatus req.user ', req.user);

    let astrologerData = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });
    console.log('getAstrologerStatus astrologerData ', astrologerData);

    if (astrologerData.astrologer_status == 'busy') {
        return res.status(200).json({
            title: "This astrologer is busy with another consumer.",
            error: true,
            data: astrologerData
        });
    }
    return res.status(200).json({
        title: 'Astrologer is available',
        data: astrologerData,
        error: false
    });
}

/*
# parameters: token
# purpose: To call astrologer bu audio
user: consumer
*/
const makeVoiceCall = async (req, res) => {
    console.log('makeVoiceCall req.body ', req.body);

    const result = validationResult(req);
    console.log('makeVoiceCall errors ', result);

    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    console.log('makeVoiceCall req.user ', req.user);

    let consumerData = req.user
    let astrologerData = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });
    console.log('makeVoiceCall astrologerData ', astrologerData);

    //   let callData = await userModel.getOngoingCall(req);
    if (!astrologerData) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    if (astrologerData.astrologer_status == 'busy') {
        return res.status(200).json({
            title: "This astrologer is busy with another consumer.",
            error: true,
            data: astrologerData
        });
    }

    var astrologer_rate = astrologerData.client_audio_rate
    var consumer_wallet = consumerData.wallet_balance

    var call_time_sec = 60 / (astrologer_rate / consumer_wallet)
    var call_time_min = 0

    if (call_time_sec > 60) {
        call_time_min = call_time_sec / 60
        call_time_sec = call_time_sec % 60
    }

    var msg = "Your wallet balance is insufficient for making this call. This astrologer charges ₹" + astrologer_rate + " per minute."

    //minimum 30 seconds
    if (consumer_wallet < (astrologer_rate)) {
        return res.status(200).json({
            title: msg,
            error: true
        });
    }

    //create name for room
    var randString = randomstring.generate(7);
    var callDetailData = new calldetailModel({
        schedule_name: randString,
        consumer_id: req.user._id,
        astrologer_id: req.body.astrologer_id,
        consumer_name: consumerData.unique_name,
        astrologer_name: astrologerData.unique_name,
        call_audio_video: 'audio',
        call_started: true
    });

    callDetailData.save((err, calldet) => {
        console.log('makeVoiceCall callDetailData ', err, calldet);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update details.',
                error: true
            });
        }

        astrologerData.astrologer_status = 'busy'
        astrologerData.save((err, astroData) => {
            console.log('makeVoiceCall astroData ', err, astroData);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to update details.',
                    error: true
                });
            }

            notificationController.sendAstrologerStatus(astroData)

            console.log('makeVoiceCall sendAstrologerStatus ');

            tokenGenerator(req, res, function (status, token) {
                console.log('tokenGenerator response ', status, token);

                var voiceToken = token;

                callDetailData.save((err, calldet) => {
                    if (err) {
                        return res.status(200).json({
                            title: 'error occured in call details',
                            error: false
                        });
                    }

                    console.log('call audio err ', err, calldet);

                    // CANCEL ALL CONSUMER'S SENT REQS & ASTROLOGER'S RECEIVED REQS 
                    // SEND CANCELLED MSG TO CONSUMER & MISSED MSG TO ASTROLOGER
                    let autoCancelData = {
                        consumer_id: {
                            _id: consumerData._id
                        },
                        astrologer_id: {
                            _id: astrologerData._id
                        }
                    };

                    chatController.autoCancelRequest(autoCancelData);

                    let currentTime = new Date(Date.now());
                    let schedulerTime = new Date(currentTime.getTime() + 20000);

                    console.log('call audio currentTime ', currentTime, schedulerTime);

                    let randString = randomstring.generate(7);
                    let newEndSession = new chatSessionModel({
                        schedule_name: randString + 'missed_call',
                        call_id: calldet._id,
                        schedule_type: 'missed_call',
                        start_date: schedulerTime
                    })

                    newEndSession.save((err, sessiondata) => {
                        let endCall = nodeSchedule.scheduleJob(randString + 'missed_call', schedulerTime, () => {
                            calldetailModel
                                .findOne({ _id: calldet._id })
                                .exec(function (err, initCallDetails) {
                                    console.log('call audio completed initCallDetails ', err, initCallDetails);

                                    if (initCallDetails.room_status == 'no_status') {

                                        initCallDetails.call_started = false
                                        initCallDetails.save((err, initCallDetailsSaved) => {

                                            console.log('makeVoiceCall initCallDetails ', err, initCallDetailsSaved);

                                            astrologerData.astrologer_status = 'online'
                                            astrologerData.save((err, astroDataSaved) => {

                                                console.log('makeVoiceCall astrologerData ', err, astroDataSaved);

                                            })
                                        })
                                    }
                                })

                            //cancel schedule
                            var myScheduleJob = nodeSchedule.scheduledJobs[randString + 'missed_call'];
                            console.log('makeVoiceCall sessionData end_chat ', myScheduleJob);
                            if (myScheduleJob != undefined) {
                                myScheduleJob.cancel();
                            }

                            chatSessionModel.deleteMany({ call_id: calldet._id }, function (error, data) {
                                console.log('makeVoiceCall deleteMany ', error, data);
                            });
                        })
                    })

                    return res.status(200).json({
                        title: 'call initiated',
                        data: calldet,
                        token: voiceToken,
                        error: false
                    });
                })

            })
        })
    })

}

/*
# parameters: token
# purpose: Voice Request URL for twilio call which is added in twilio twiml application
*/
const makeCall = async (request, response) => {
    let to = null;

    console.log('makeCall req.body -- ', request.body, 'roomname  ==', request.body.roomName);
    var consumer_name = request.body.From.replace(/client:/g, '');

    let consumer = await userModel.getUserFromQuery({ unique_name: consumer_name });
    console.log('makeCall consumer-- ', consumer);

    let astrologer = await userModel.getUserFromQuery({ unique_name: request.body.to });
    console.log('makeCall astrologer-- ', astrologer);

    var astrologer_rate = astrologer.client_audio_rate
    var consumer_wallet = consumer.wallet_balance

    var call_time_sec = parseInt(60 / (astrologer_rate / consumer_wallet))
    console.log('makeCall call_time_sec-- ', call_time_sec);
    if (call_time_sec > 3600) { //4 hours = 14400
        call_time_sec = 3600 //one hour
    }
    console.log('makeCall call_time_sec after-- ', call_time_sec);

    if (request.method == 'POST') {
        to = request.body.to;
    } else {
        to = request.query.to;
    }

    const voiceResponse = new VoiceResponse();

    if (!to) {
        console.log('makeCall to no -- ')
        voiceResponse.say("Congratulations! You have made your first call! Good bye.");
    } else {
        var answerOnBridge = false
        if (consumer.device_type == 'ios') {
            answerOnBridge = "true"
        }
        const dial = voiceResponse.dial({
            //    answerOnBridge: "true",
            //  answerOnBridge: false,
            answerOnBridge: answerOnBridge,
            timeLimit: call_time_sec, //30
            action: process.env.baseUrl + '/call/handleDialCallStatus',
            method: 'POST'
            //    ringTone: 'in'//'https://dl.espressif.com/dl/audio/gs-16b-2c-44100hz.mp3'
            //    timeout: 30
        });

        const client = dial.client({
            statusCallbackEvent: 'initiated ringing answered completed',
            statusCallback: process.env.baseUrl + '/call/voiceCallback', //'https://56211ba48b6a.ngrok.io/call/voiceCallback', 
            statusCallbackMethod: 'POST'
        }, to);

        /*
        client.parameter({
            name: 'roomName',
            value: request.body.roomName
        });
        */
        client.parameter({
            name: 'first_name',
            value: consumer.first_name//request.body.fromName
        });
        // if (consumer.last_name != "") {
        client.parameter({
            name: 'last_name',
            value: consumer.last_name ? consumer.last_name : ''
        });
        // }
        // if (consumer.profile_url != "") {
        client.parameter({
            name: 'profile_url',
            value: consumer.profile_url ? consumer.profile_url : ''
        });
        // }
    }
    console.log('makeCall to response -- ', voiceResponse.toString())

    return response.send(voiceResponse.toString());
}

/*
# parameters: token
# purpose: To get audio and video call listing
*/
const callListing = async (req, res) => {
    console.log('callListing req.body', req.body)
    console.log('callListing req.user', req.user)

    const result = validationResult(req);
    console.log('callListing errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let calls = await calldetailModel.getCalls(req);

    let isData = calls.length == 0 ? false : true

    console.log('callListing calls', calls.length)

    return res.status(200).json({
        title: "Call listing",
        error: false,
        data: isData ? calls[0].data : [],
        total_count: isData ? calls[0].totalCount : 0
    });
}

/*
# parameters: token
# purpose: To get token for voice call
*/
const tokenGenerator = (req, res, cb) => {
    console.log('tokenGenerator req.body ', req.body);
    console.log('tokenGenerator req.user ', req.user);

    console.log('tokenGenerator req.user.unique_name ', req.user.unique_name);

    var identity = req.user.unique_name

    // Used when generating any kind of tokens
    const accountSid = process.env.accountSid;
    const apiKey = process.env.API_KEY_SID;
    const apiSecret = process.env.API_KEY_SECRET;

    // Used specifically for creating Voice tokens 
    var pushCredSid;
    if (req.body.environment == 'DEBUG') {
        pushCredSid = process.env.TestPushCredSid;
    } else {
        pushCredSid = process.env.LivePushCredSid;
    }

    const outgoingApplicationSid = process.env.APP_SID;

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: outgoingApplicationSid,
        pushCredentialSid: pushCredSid
    });

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    const token = new AccessToken(accountSid, apiKey, apiSecret, { ttl: 82100 });
    token.addGrant(voiceGrant);
    token.identity = identity;
    console.log('Token:' + token.toJwt());

    // if (req.body.on_app_open === true) {
    //     return res.status(200).json({
    //         title: 'Token Voice',
    //         token: token.toJwt(),
    //         error: false
    //     });
    // }

    if (req.user.user_type == "consumer") {
        return cb(true, token.toJwt());
    }

    return res.status(200).json({
        title: 'Token Voice',
        token: token.toJwt(),
        error: false
    });
}

/*
# parameters: webhook
# Variables used : caller_name, pro_name, is_ready
# purpose: webhook for twilio voice call
logic :-
1. If call initiated, update calldetails with status and room id
2. If the call didn't connect, send notification to the user
3. If call completed, save call duration and status
4. If call busy, save details
*/
const voiceCallback = (req, res, cb) => {
    var consumer_name = req.body.From.replace(/client:/g, '');
    var astrologer_name = req.body.To.replace(/client:/g, '');

    console.log('events req.body -- ', req.body);
    console.log('events consumer_name -- ', consumer_name, astrologer_name);

    //1
    if (req.body.CallStatus == "initiated") {
        calldetailModel.findOneAndUpdate({
            $or: [{
                $and: [
                    { 'astrologer_name': astrologer_name }, { 'consumer_name': consumer_name }, { call_started: true }]
            }, {
                $and: [
                    { 'astrologer_name': consumer_name }, { 'consumer_name': astrologer_name }, { call_started: true }]
            }]
        }, { $set: { room_status: req.body.CallStatus, room_sid: req.body.CallSid } }, { new: true }).then((newData, err) => {
            console.log('events initiated saved ', err, newData);
        })
    }

    /*
    else {
        calldetailModel.findOneAndUpdate({ room_sid: req.body.CallSid }, { $set: { room_status: req.body.CallStatus, call_started: false } }, { new: true }).then((newData, err) => {
            console.log('events others saved ', err, newData);
        })
    }*/

    if (req.body.CallStatus == "in-progress") {
        console.log('events in-progress -- ');

        calldetailModel.findOneAndUpdate({ room_sid: req.body.CallSid }, { $set: { room_status: req.body.CallStatus, start_date: new Date()/*, call_started: false */ } }, { new: true }).then((newData, err) => {
            console.log('events others saved ', err, newData);
        })

        setTimeout(function () {
            calldetailModel
                .findOne({ room_sid: req.body.CallSid })
                .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
                .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url')
                .exec(function (err, calldet) {
                    console.log('events in-progress err-- ', err, calldet);
                    if (calldet) {
                        let consumerData = {
                            msg: "remote_connected",
                            title: "Astro",
                            device_token: calldet.consumer_id.device_token,
                            data: {
                                message: "remote_connected",
                                flag: "remote_connected",
                                call_sid: req.body.CallSid
                            }
                        }
                        notificationController.sendSilentNotification(consumerData)
                    }
                })
        }, 3000);
    }

    //2
    if (req.body.CallStatus == 'no-answer'/* || req.body.CallDuration == '0'*/) {
        setTimeout(function () {
            calldetailModel
                .findOne({ room_sid: req.body.CallSid })
                .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
                .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url')
                .exec(function (err, calldet) {
                    //    var msgEnd1 = 'You missed the call with ' + calldet.consumer_id.first_name.charAt(0).toUpperCase() + calldet.consumer_id.first_name.slice(1);
                    var msgEnd1 = "Oops! You missed an incoming voice call from " + calldet.consumer_id.first_name.charAt(0).toUpperCase() + calldet.consumer_id.first_name.slice(1)
                    calldetailModel.findOneAndUpdate({ room_sid: req.body.CallSid }, { $set: { room_status: "missed by astrologer", call_started: false, caller_duration: req.body.CallDuration, astrologer_duration: req.body.CallDuration } }, { new: true }).then((newData, err) => {

                        //change astrologer status
                        calldet.astrologer_id.astrologer_status = 'online'

                        //astrologer is online
                        //    notificationController.sendAstrologerStatus(calldet.astrologer_id)                
                        calldet.astrologer_id.save((err, data) => {
                            console.log('data in events err', err, data);
                            if (err) {

                            }
                        })

                        //to astrologer
                        let astrologerData = {
                            msg: msgEnd1,
                            title: "",
                            device_token: calldet.astrologer_id.device_token,
                            data: {
                                targetedScreen: 'audio_call',
                                message: msgEnd1,
                                flag: "Missed Call",
                            }
                        }
                        astrologerData.data.user_id = calldet.astrologer_id._id
                        astrologerData.data.sec_user_id = calldet.consumer_id._id

                        notificationController.sendNotification(astrologerData)

                        //send mail to astrologer
                        let mailData = {
                            email: calldet.astrologer_id.email,
                            subject: 'Oops! You missed a voice call',
                            body:
                                "<p>" +
                                "Hello " + calldet.astrologer_id.first_name + "," +
                                "<p>" +
                                "You missed an incoming voice call from " + calldet.consumer_id.first_name.charAt(0).toUpperCase() + calldet.consumer_id.first_name.slice(1) + ". Check their profile on Astrowize app now." +
                                "<p>" +
                                "Regards," +
                                "<br>" +
                                "Team AstroWize"
                        };
                        helper.sendEmail(mailData)
                    })
                })
        }, 1000);
    }

    //3
    if (req.body.CallStatus == 'completed') {
        //  setTimeout(function () {
        calldetailModel
            .findOne({ room_sid: req.body.CallSid })
            .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
            .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url subscribed_users audio_rate client_audio_rate')
            .populate({
                path: 'astrologer_id',
                populate: {
                    path: 'subscribed_users.consumer_id'
                }
            })
            .exec(function (err, calldet) {
                console.log('call audio completed calldet ', err, calldet);

                processCallCompleted(calldet, req.body.CallDuration, req.body.CallDuration)
            })
        //       }, 1000);
    }

    //4
    if (req.body.CallStatus == 'busy') {
        //    setTimeout(function () {
        calldetailModel
            .findOne({ room_sid: req.body.CallSid })
            .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
            .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url')
            .exec(function (err, calldet) {
                calldetailModel.findOneAndUpdate({ room_sid: req.body.CallSid }, { $set: { room_status: "declined", call_started: false, caller_duration: 0, astrologer_duration: 0 } }, { new: true }).then((newData, err) => {
                    console.log('data in events busy err', err, newData);
                })

                //change astrologer status
                calldet.astrologer_id.astrologer_status = 'online'

                //astrologer is online
                //    notificationController.sendAstrologerStatus(calldet.astrologer_id)                
                calldet.astrologer_id.save((err, data) => {
                    console.log('data in events err', err, data);
                    if (err) {

                    }
                })
            })
        //    }, 1000);
    }

    res.sendStatus(200)
}

const processCallCompleted = (calldet, astrologer_duration, consumer_duration) => {
    calldet.room_status = 'success'
    calldet.call_started = false
    calldet.astrologer_duration = astrologer_duration
    calldet.consumer_duration = consumer_duration

    let targetedScreen = ''
    //call rate calculation
    var call_rate = 0
    var client_call_rate = 0
    if (calldet.call_audio_video == 'audio') {
        call_rate = parseFloat(parseFloat(astrologer_duration / 60) * parseFloat(calldet.astrologer_id.audio_rate)).toFixed(2)
        client_call_rate = parseFloat(parseFloat(astrologer_duration / 60) * parseFloat(calldet.astrologer_id.client_audio_rate)).toFixed(2)
        targetedScreen = 'audio_listing'
    }
    if (calldet.call_audio_video == 'video') {
        targetedScreen = 'video_listing'

        call_rate = parseFloat(parseFloat(astrologer_duration / 60) * parseFloat(calldet.astrologer_id.video_rate)).toFixed(2)
        client_call_rate = parseFloat(parseFloat(astrologer_duration / 60) * parseFloat(calldet.astrologer_id.client_video_rate)).toFixed(2)
    }

    calldet.call_rate = call_rate
    calldet.client_call_rate = client_call_rate

    console.log('jobSeeker in events call_rate', call_rate, client_call_rate);

    if (calldet.consumer_id.wallet_balance - client_call_rate >= 0) {
        calldet.consumer_id.wallet_balance = parseFloat(calldet.consumer_id.wallet_balance - client_call_rate).toFixed(2)
    }
    else {
        calldet.consumer_id.wallet_balance = 0
    }

    calldet.consumer_id.save((err, userData) => {
        console.log('jobSeeker in events userData', err, userData);

        if (err) {

        }
    })

    calldet.save((err, calldetails) => {
        console.log('jobSeeker in events calldetails', err, calldetails);

        if (err) {

        }
    })

    //to save transaction
    var transData = new transModel({
        transaction_type: 'audio',
        consumer_id: calldet.consumer_id._id,
        payment_status: "success",
        call_id: calldet._id,
        payment_type: "wallet",
        astrologer_id: calldet.astrologer_id._id,
        transaction_amt: call_rate,
        client_transaction_amt: client_call_rate
    })
    if (calldet.call_audio_video == 'video') {
        transData.transaction_type = "video"
    }
    transModel.saveTransaction(transData, (err, savedData) => {
        console.log('jobSeeker in events savedData', err, savedData);

        if (err) {

        }
    })

    if (calldet.call_audio_video == 'audio') {
        //change astrologer status
        calldet.astrologer_id.astrologer_status = 'online'

        //astrologer is online
        //    notificationController.sendAstrologerStatus(calldet.astrologer_id)
        calldet.astrologer_id.subscribed_users.forEach(function (value, i) {
            console.log('calldet.astrologer_id.subscribed_users forach--', i, value);

            calldet.astrologer_id.subscribed_users[i].notified = true
        });

        calldet.astrologer_id.save((err, data) => {
            console.log('data in events forach', err, data);
            if (err) {

            }
        })
    }

    //sending notification call completed
    var msg = "Your voice call was successfully completed. Click here to rate our voice call services."
    if (calldet.call_audio_video == 'video') {
        msg = "Your video call was successfully completed. Click here to rate the video call quality."
    }

    //to astrologer
    let astrologerData = {
        msg: msg,
        title: "",
        device_token: calldet.astrologer_id.device_token,
        data: {
            targetedScreen,
            message: msg,
            flag: "Call Completed",
        }
    }
    astrologerData.data.user_id = calldet.astrologer_id._id
    astrologerData.data.sec_user_id = calldet.consumer_id._id

    notificationController.sendNotification(astrologerData)

    //send mail to astrologer
    let msgBody = "Your call session with " + calldet.consumer_id.first_name.charAt(0).toUpperCase() + calldet.consumer_id.first_name.slice(1) + " was successfully completed. Click here to rate our voice call services."
    if (calldet.call_audio_video == 'video') {
        msgBody = "Your video call session with " + calldet.consumer_id.first_name.charAt(0).toUpperCase() + calldet.consumer_id.first_name.slice(1) + " was successfully completed. Click here to rate our video call quality."
    }
    let mailData = {
        email: calldet.astrologer_id.email,
        subject: 'Voice call session completed',
        body:
            "<p>" +
            "Hello " + calldet.astrologer_id.first_name + "," +
            "<p>" +
            msgBody +
            "<p>" +
            "Regards," +
            "<br>" +
            "Team AstroWize"
    };
    helper.sendEmail(mailData)

    //to consumer
    let time = moment.duration(astrologer_duration, 'seconds')
    // var durationMin = parseInt(astrologer_duration) / 60 + " minutes" + (astrologer_duration % 60 ? 0 : "" + astrologer_duration % 60 + " seconds")
    // if (astrologer_duration < 60) {
    //     durationMin = astrologer_duration + " seconds"
    // }
    // else if (astrologer_duration / 60 < 2) {
    //     durationMin = parseInt(astrologer_duration / 60) + " minute" + (astrologer_duration % 60 ? 0 : "" + astrologer_duration % 60 + " seconds")
    // }
    var durationMin = moment.duration(astrologer_duration, 'seconds') > 0 ? `${time.hours() > 0 ? time.hours() + ' hours' : ''} ${time.minutes() > 0 ? time.minutes() + ' minutes' : ''} ${time.seconds() > 0 ? time.seconds() + ' seconds' : ''}` : ''
    var msg1 = "Voice call completed! Your audio call session of " + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your Astrowize wallet."
    if (calldet.call_audio_video == 'video') {
        msg1 = "Video call completed! Your video call session of " + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your Astrowize wallet."
    }
    let consumerData = {
        msg: msg1,
        title: "",
        device_token: calldet.consumer_id.device_token,
        data: {
            targetedScreen: 'wallet_screen',
            message: msg1,
            flag: "Call Completed",
        }
    }
    consumerData.data.user_id = calldet.consumer_id._id
    consumerData.data.sec_user_id = calldet.astrologer_id._id
    notificationController.sendNotification(consumerData)

    //send mail to consumer
    var consumerMsgbody = "Your audio call session of" + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your Astrowize wallet. Thank you for using our services."
    if (calldet.call_audio_video == 'video') {
        consumerMsgbody = "Your video call session of" + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your Astrowize wallet. Thank you for using our services"
    }
    let consMailData = {
        email: calldet.consumer_id.email,
        subject: 'AstroWize - Audio call session completed!',
        body:
            "<p>" +
            "Hello " + calldet.consumer_id.first_name + "," +
            "<p>" +
            consumerMsgbody +
            "<p>" +
            "Regards," +
            "<br>" +
            "Team AstroWize"
    };
    helper.sendEmail(consMailData)

    //sms
    var consumerSmsBody = "Your audio call session of" + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your AstroWize wallet. Thank you for using our services, FINOTO."
    var template_id = "1707160828821117452"//"3bdb91e6-f8bf-47b0-951f-e94d6169ef62"

    if (calldet.call_audio_video == 'video') {
        consumerSmsBody = "Video call completed! Your video call session of" + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your AstroWize wallet. Thank you for using our services, FINOTO."
        template_id = "1707160828863479889"//"80207fc1-ed0c-47ea-93e7-da5d3c7fd6a0"
    }
    var smsData = {}
    smsData.to = ['91' + calldet.consumer_id.mobile.replace(/\D/g, '')]
    smsData.template_id = template_id
    smsData.message = "Hello " + calldet.consumer_id.first_name + ",\n" + consumerSmsBody
    let sms = helper.sendSMS(smsData)

    //send mail to admin
    var adminMailSub = "AstroWize - Audio call session completed!"
    var adminMailMsg = "An audio call session for" + durationMin + " between " + calldet.consumer_id.first_name + " and " + calldet.astrologer_id.first_name + " has ended." +
        "<p>" +
        "Kindly settle the amount of ₹" + client_call_rate + " with " + calldet.astrologer_id.first_name + "."

    if (calldet.call_audio_video == 'video') {
        adminMailSub = "AstroWize - Video call session completed!"
        adminMailMsg = "A video call session for" + durationMin + " between " + calldet.consumer_id.first_name + " and " + calldet.astrologer_id.first_name + " has ended." +
            "<p>" +
            "Kindly settle the amount of ₹" + client_call_rate + " with " + calldet.astrologer_id.first_name + "."
    }

    let adminMailData = {
        email: process.env.mail_username,
        subject: adminMailSub,
        body:
            "<p>" +
            "Hello " + "Admin" + "," +
            "<p>" +
            adminMailMsg +
            "<p>" +
            "Regards," +
            "<br>" +
            "Team AstroWize"
    };
    helper.sendEmail(adminMailData)

    //notify subscribed consumers about astrologer online
    console.log('calldet.astrologer_id subscribed_users', calldet.astrologer_id.subscribed_users);
    if (calldet.astrologer_id.subscribed_users && calldet.astrologer_id.subscribed_users.length > 0) {
        let sub_consumers = calldet.astrologer_id.subscribed_users

        async.eachOfSeries(sub_consumers, function (consumer, key, cb) {
            //to consumer
            if (consumer.consumer_id) {
                var msgSub = "Knock Knock! " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " is now online and available for chat/audio call/video call/report. Click here to connect with them"
                let consData = {
                    msg: msgSub,
                    targetedScreen: 'online_notification',
                    title: "",
                    device_token: consumer.consumer_id.device_token,
                    data: {
                        message: msgSub,
                        flag: "Astrologer Online",
                    }
                }
                consData.data.user_id = consumer.consumer_id._id
                consData.data.sec_user_id = calldet.astrologer_id._id
                notificationController.sendNotification(consData)

                //send mail to consumer
                let consumerMailData = {
                    email: consumer.consumer_id.email,
                    subject: 'AstroWize - Your personal Astrologer is online!',
                    body:
                        "<p>" +
                        "Hello " + consumer.consumer_id.first_name + "," +
                        "<p>" +
                        calldet.astrologer_id.first_name + "is now online and available for chat/audio call/video call/report. You can now connect with them on Astrowize app. " +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(consumerMailData)
            }

            cb()
        }, function (err) {
            console.log('consumer done--------', err);
        })
    }
}

/*
# parameters: token
# purpose: To call astrologer by video
user: consumer
*/
const makeVideoCall = async (req, res) => {
    console.log('makeVideoCall req.body ', req.body);

    const result = validationResult(req);
    console.log('makeVideoCall errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    console.log('makeVideoCall req.user ', req.user);

    let consumerData = req.user
    let astrologerData = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });
    console.log('makeVoiceCall astrologerData ', astrologerData);

    if (astrologerData.astrologer_status == 'busy') {
        return res.status(200).json({
            title: "This astrologer is with another consumer.",
            error: true,
            data: astrologerData
        });
    }

    var astrologer_rate = astrologerData.audio_rate
    var consumer_wallet = consumerData.wallet_balance

    var call_time_sec = 60 / (astrologer_rate / consumer_wallet)
    var call_time_min = 0
    if (call_time_sec > 60) {
        call_time_min = call_time_sec / 60
        call_time_sec = call_time_sec % 60
    }

    var msg = "Your wallet balance is insufficient fo making this call. This astrologer charges ₹" + astrologer_rate + " per minute."

    //minimum 30 seconds
    if (consumer_wallet < astrologer_rate / 2) {
        return res.status(200).json({
            title: msg,
            error: true
        });
    }

    //create name for room
    var randString = randomstring.generate(7);

    var randStringCaller = consumerData.unique_name + randomstring.generate(6);
    var randStringPro = astrologerData.unique_name + randomstring.generate(6);

    console.log('callnow randString ---', randString, 'caller', randStringCaller, 'randStringPro ', randStringPro);

    var callDetailData = new calldetailModel({
        schedule_name: randString,
        consumer_id: req.user._id,
        astrologer_id: req.body.astrologer_id,
        start_date: new Date(),
        consumer_name: randStringCaller,
        astrologer_name: randStringPro,
        call_audio_video: 'video',
        call_started: true
    });

    callDetailData.save((err, calldet) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update details.',
                error: true
            });
        }

        astrologerData.astrologer_status = 'busy'
        astrologerData.save((err, astroData) => {
            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to update details.',
                    error: true
                });
            }

            //astrologer is busy
            //    notificationController.sendAstrologerStatus(astrologerData)

            //to create video room
            client.video.rooms
                .create({
                    uniqueName: randString,
                    type: 'peer-to-peer',
                    duration: 60,
                    'Content-Type': 'audio/mpeg',
                    statusCallback: process.env.baseUrl + '/call/videoCallback'//'https://e264c0e4cdad.ngrok.io' + '/call/videoCallback' 
                })
                .then(room => {
                    console.log('after video room creation ', room);

                    //accesstoken for employer
                    accessToken.identity = randStringPro;

                    // Create a Video grant which enables a client to use Video 
                    // and limits access to the specified Room (DailyStandup)
                    const videoGrant = new VideoGrant({
                        room: randString
                    });

                    // Add the grant to the token
                    accessToken.addGrant(videoGrant);

                    console.log('video accessToken. pro ', accessToken.toJwt());

                    //to astrologer
                    var msg = "Incoming video call"
                    let astroData = {
                        msg: msg,
                        title: "",
                        device_token: astrologerData.device_token,
                        data: {
                            message: msg,
                            flag: "Call Completed",
                            roomName: randString,
                            accessToken: accessToken.toJwt(),
                            to_name: consumerData.first_name,
                            to_profileImage: consumerData.profile_url,
                            call_type: "video"
                        }
                    }
                    astroData.data.user_id = astrologerData._id
                    astroData.data.sec_user_id = consumerData._id
                    notificationController.sendNotification(astroData)

                    //accesstoken for employer
                    accessToken.identity = randStringCaller;
                    // and limits access to the specified Room (DailyStandup)
                    const videoGrant2 = new VideoGrant({
                        room: randString
                    });
                    accessToken.addGrant(videoGrant2);

                    console.log('video accessToken. caller ', accessToken.toJwt());

                    var data = {
                        accessToken: accessToken.toJwt(),
                        roomName: randString
                    }

                    // CANCEL ALL CONSUMER'S SENT REQS & ASTROLOGER'S RECEIVED REQS 
                    // SEND CANCELLED MSG TO CONSUMER & MISSED MSG TO ASTROLOGER
                    let autoCancelData = {
                        consumer_id: {
                            _id: consumerData._id
                        },
                        astrologer_id: {
                            _id: astrologerData._id
                        }
                    };

                    chatController.autoCancelRequest(autoCancelData);

                    if (consumerData.device_type == 'ios' && req.body.device_type == 'ios') {
                        return res.status(200).json({
                            message: 'call initiated',
                            data: calldet,
                            token: accessToken.toJwt(),
                            roomName: randString,
                            error: false
                        });
                    }
                    return res.status(200).json({
                        message: 'call initiated',
                        obj: {},
                        data: data,
                        error: false
                    });
                })
        })
    })
}

/*
# parameters: webhook
# Variables used : msgEnd1, msgEnd2, msg
# purpose: webhook for twilio video call
logic 1. end call if one user disconnects
2. remove all callers from queue when pro quits app directly
3. remove current user from queue
4. delete videocall notification schedule
5. delete queue schedule
*/
const videoCallback = (req, res, cb) => {
    console.log('videoCallback req.body ', req.body);
    res.sendStatus(200);
    if (req.body.RoomStatus == "completed") {
        setTimeout(function () {
            console.log('videoCallback after 6 sec ', req.body);

            calldetailModel
                .findOne({ 'schedule_name': req.body.RoomName })
                .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
                .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url subscribed_users video_rate client_video_rate')
                .populate({
                    path: 'astrologer_id',
                    populate: {
                        path: 'subscribed_users.consumer_id'
                    }
                })
                .exec(function (err, callDet) {
                    console.log('videoCallback after 6 callDet ', callDet);

                    if (callDet) {
                        var msgEnd1 = 'You missed the call with ' + callDet.astrologer_id.first_name.charAt(0).toUpperCase() + callDet.astrologer_id.first_name.slice(1);
                        var msgEnd2 = "Oops! You missed a video call from " + callDet.consumer_id.first_name.charAt(0).toUpperCase() + callDet.consumer_id.first_name.slice(1) + "."

                        if ((callDet.consumer_duration == "0") && (callDet.astrologer_duration == "0")) {     //if both astrologer and consumer duration is 0
                            console.log('both videocall 6 sec here 0 ');

                            callDet.room_status = "failed"
                        } else if (callDet.consumer_duration == "0") {     //if consumer duration is 0
                            console.log('consumer_duration videocall 6 sec here 0 ');

                            callDet.room_status = "missed by consumer"

                            var msg = 'Your call is completed with ' + callDet.consumer_id.first_name.charAt(0).toUpperCase() + callDet.consumer_id.first_name.slice(1);

                            //to astrologer
                            let astrologerData = {
                                msg: msg,
                                title: "",
                                device_token: callDet.astrologer_id.device_token,
                                data: {
                                    message: msg,
                                    flag: "Call Completed",
                                }
                            }
                            astrologerData.data.user_id = callDet.astrologer_id._id
                            astrologerData.data.sec_user_id = callDet.consumer_id._id
                            notificationController.sendNotification(astrologerData)

                            //to consumer
                            let consumerData = {
                                msg: msgEnd1,
                                title: "",
                                device_token: callDet.consumer_id.device_token,
                                data: {
                                    message: msgEnd1,
                                    flag: "Call Ended",
                                }
                            }

                            consumerData.data.user_id = callDet.consumer_id._id
                            consumerData.data.sec_user_id = callDet.astrologer_id._id

                            notificationController.sendNotification(consumerData)
                        } else if (callDet.astrologer_duration == "0") {     //if both astrologer and consumer duration is 0
                            console.log('astrologer_duration videocall 6 sec here 0 ');

                            callDet.room_status = "missed by astrologer"

                            //to astrologer
                            let astrologerData = {
                                msg: msgEnd2,
                                title: "",
                                device_token: callDet.astrologer_id.device_token,
                                data: {
                                    message: msgEnd2,
                                    flag: "Missed Call",
                                }
                            }
                            astrologerData.data.user_id = callDet.astrologer_id._id
                            astrologerData.data.sec_user_id = callDet.consumer_id._id
                            notificationController.sendNotification(astrologerData)

                            //send mail to astrologer
                            let mailData = {
                                email: callDet.astrologer_id.email,
                                subject: 'Oops! You missed a video call',
                                body:
                                    "<p>" +
                                    "Hello " + callDet.astrologer_id.first_name + "," +
                                    "<p>" +
                                    "You missed an incoming video call from " + callDet.consumer_id.first_name + ". Check their profile on Astrowize app now." +
                                    "<p>" +
                                    "Regards," +
                                    "<br>" +
                                    "Team AstroWize"
                            };
                            helper.sendEmail(mailData)
                        } else {
                            //success
                            processCallCompleted(callDet, callDet.astrologer_duration, callDet.consumer_duration)
                        }

                        //saving call details to mongod
                        callDet.save((err, callSave) => {
                            if (err) {
                                console.log('videoCallback completed err ', err, callSave);
                            }
                        });
                        //change astrologer status
                        callDet.astrologer_id.astrologer_status = 'online'

                        //astrologer is online
                        //    notificationController.sendAstrologerStatus(calldet.astrologer_id)
                        callDet.astrologer_id.subscribed_users.forEach(function (value, i) {
                            console.log('videoCallback forach --', i, value);

                            callDet.astrologer_id.subscribed_users[i].notified = true
                        });
                        callDet.astrologer_id.save((err, data) => {
                            console.log('videoCallback events forach', err, data);
                            if (err) {

                            }
                        })
                    }
                })
        }, 6000);
    }
    else if (req.body.ParticipantStatus == "disconnected") { ////in-progress, ringing, initiated, completed
        //1
        client.video.rooms(req.body.RoomSid)
            .update({
                status: 'completed'
            }).then((room) => {

            });

        calldetailModel
            .findOneAndUpdate({ 'consumer_name': req.body.ParticipantIdentity },
                { $set: { "room_sid": req.body.RoomSid, "consumer_status": req.body.ParticipantStatus, "consumer_duration": req.body.ParticipantDuration, "consumer_call_id": req.body.ParticipantSid } })
            .exec((err, data) => {
                console.log('videoCallback consumer_name err ', err);
                console.log('videoCallback consumer_name data ', data);

                if (data) {

                }
            })

        calldetailModel
            .findOneAndUpdate({ 'astrologer_name': req.body.ParticipantIdentity },
                { $set: { "room_sid": req.body.RoomSid, "astrologer_status": req.body.ParticipantStatus, "astrologer_duration": req.body.ParticipantDuration, "astrologer_call_id": req.body.ParticipantSid } })
            .exec((err, data) => {
                console.log('videoCallback astrologer_name err ', err);
                console.log('videoCallback astrologer_name data ', data);

            })

        calldetailModel.findOneAndUpdate({ 'room_sid': req.body.RoomSid }, { $set: { call_started: false } }, { new: true }).then((newData, err) => {
            console.log('videoCallback others saved ', err, newData);
        })
    }
    else if (req.body.ParticipantStatus == "connected") {
        //astrologer details
        calldetailModel
            .findOneAndUpdate({ 'pro_name': req.body.ParticipantIdentity },
                { $set: { "room_sid": req.body.RoomSid, "astrologer_status": req.body.ParticipantStatus, "astrologer_call_id": req.body.ParticipantSid } })
            .exec((err, data) => {

                if (data) {

                }
            })

        //consumer details
        calldetailModel
            .findOneAndUpdate({ 'caller_name': req.body.ParticipantIdentity },
                { $set: { "room_sid": req.body.RoomSid, "consumer_status": req.body.ParticipantStatus, "consumer_call_id": req.body.ParticipantSid } })
            .exec((err, data) => {
                if (data) {

                }
            })
    }
    else {
        calldetailModel
            .findOneAndUpdate({ 'schedule_name': req.body.RoomName },
                { $set: { "room_sid": req.body.RoomSid } })
            .exec((err, data) => {
                console.log('videoCallback pro_name err else ', err);
                console.log('videoCallback pro_name data else ', data);
            })
    }
}

/*
# parameters: token
# purpose: To end audio call
user: consumer
*/
const endVoiceCall = async (req, res) => {
    calldetailModel
        .findOne({ consumer_id: req.body.consumer_id, astrologer_id: req.body.astrologer_id, call_started: true, call_audio_video: "audio" })
        .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
        .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url')
        .exec(function (err, calldet) {
            console.log('endVoiceCall pro_name err ', err);
            console.log('endVoiceCall pro_name err ', calldet);

            if (!calldet) {
                return res.status(200).json({
                    title: "Call not found",
                    error: true,
                    data: calldet
                });
            }

            calldet.astrologer_id.astrologer_status = "online"

            calldetailModel.findOneAndUpdate({ consumer_id: req.body.consumer_id, astrologer_id: req.body.astrologer_id, call_started: true, call_audio_video: "audio" }, { $set: { call_started: false } }, { new: true }).then((newData, err) => {
                console.log('endVoiceCall others saved ', err, newData);
            })

            calldet.astrologer_id.save((err, astrologer) => {
                console.log('endVoiceCall astrologer err ', err);
                console.log('endVoiceCall astrologer err ', astrologer);

                if (err) {
                    return res.status(200).json({
                        title: 'Something went wrong when trying to update details.',
                        error: true
                    });
                }
                return res.status(200).json({
                    message: 'call ended',
                    data: astrologer,
                    error: false
                });
            })
        })
}

/*
# parameters: token
# purpose: To end video call
user: consumer
*/
const endVideoCall = async (req, res) => {
    calldetailModel
        .findOne({ consumer_id: req.body.consumer_id, astrologer_id: req.body.astrologer_id, call_started: true, call_audio_video: "video" })
        .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
        .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url')
        .exec(function (err, calldet) {
            console.log('endVoiceCall pro_name err ', err);
            console.log('endVoiceCall pro_name err ', calldet);

            if (!calldet) {
                return res.status(200).json({
                    title: "Call not found",
                    error: true,
                    data: calldet
                });
            }

            calldet.astrologer_id.astrologer_status = "online"

            calldetailModel.findOneAndUpdate({ consumer_id: req.body.consumer_id, astrologer_id: req.body.astrologer_id, call_started: true, call_audio_video: "video" }, { $set: { call_started: false } }, { new: true }).then((newData, err) => {
                console.log('endVoiceCall others saved ', err, newData);
            })

            if (req.user.user_type == "consumer") {
                var msg = 'Your call declined by consumer'
                //to astrologer
                let astrologerData = {
                    msg: msg,
                    title: "",
                    device_token: calldet.astrologer_id.device_token,
                    data: {
                        message: msg,
                        flag: "Call Declined",
                    }
                }
                astrologerData.data.user_id = calldet.astrologer_id._id
                astrologerData.data.sec_user_id = calldet.consumer_id._id
                notificationController.sendNotification(astrologerData)
            }
            if (req.user.user_type == "astrologer") {
                //to consumer
                var msgEnd1 = 'Your call declined by astrologer'
                let consumerData = {
                    msg: msgEnd1,
                    title: "",
                    device_token: calldet.consumer_id.device_token,
                    data: {
                        message: msgEnd1,
                        flag: "Call Declined",
                    }
                }

                consumerData.data.user_id = calldet.consumer_id._id
                consumerData.data.sec_user_id = calldet.astrologer_id._id
                notificationController.sendNotification(consumerData)
            }

            calldet.astrologer_id.save((err, astrologer) => {
                console.log('endVoiceCall astrologer err ', err);
                console.log('endVoiceCall astrologer err ', astrologer);

                if (err) {
                    return res.status(200).json({
                        title: 'Something went wrong when trying to update details.',
                        error: true
                    });
                }
                return res.status(200).json({
                    message: 'call ended',
                    data: astrologer,
                    error: false
                });
            })
        })
}

/*
# parameters: token
# purpose: To get call status
*/
const handleDialCallStatus = (req, res) => {
    console.log('handleDialCallStatus req.body -- ', req.body);

    const voiceResponse = new VoiceResponse();

    let missed_declined = process.env.baseUrl + "/audios/missed_declined.mp3"
    console.log('handleDialCallStatus missed_declined -- ', missed_declined);

    if (req.body.DialCallStatus == "no-answer") {
        console.log('handleDialCallStatus if -- ', req.body.DialCallStatus);

        //    voiceResponse.play("https://dl.espressif.com/dl/audio/gs-16b-2c-44100hz.mp3")

        voiceResponse.play(missed_declined)
    } else if (req.body.DialCallStatus == "busy") {
        console.log('handleDialCallStatus if -- ', req.body.DialCallStatus);

        //    voiceResponse.play("https://dl.espressif.com/dl/audio/gs-16b-2c-44100hz.mp3")
        voiceResponse.play(missed_declined)
    } else {
        console.log('handleDialCallStatus else -- ', req.body.DialCallStatus);

        voiceResponse.hangup();
    }
    console.log('handleDialCallStatus res -- ', voiceResponse.toString());

    return res.send(voiceResponse.toString());
}

const makeVoiceCallNew = async (req, res) => {

    console.log('makeVoiceCallNew req.body :', req.body);

    const result = validationResult(req);
    console.log('makeVoiceCallNew errors :', result);

    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    console.log('makeVoiceCallNew req.user :', req.user);

    let consumerData = req.user
    let astrologerData = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });
    console.log('makeVoiceCall astrologerData :', astrologerData);

    if (!astrologerData) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }

    if (astrologerData.astrologer_status == 'busy') {
        return res.status(200).json({
            title: "This astrologer is busy with another consumer.",
            error: true,
            data: astrologerData
        });
    }

    let astrologer_rate = astrologerData.client_audio_rate;
    let consumer_wallet = consumerData.wallet_balance;

    let call_time_sec = 60 / (astrologer_rate / consumer_wallet)
    let call_time_min = 0

    if (call_time_sec > 60) {
        call_time_min = call_time_sec / 60
        call_time_sec = call_time_sec % 60
    }

    let msg = "Your wallet balance is insufficient for making this call. This astrologer charges ₹" + astrologer_rate + " per minute."

    //minimum 30 seconds
    if (consumer_wallet < (astrologer_rate)) {
        return res.status(200).json({
            title: msg,
            error: true
        });
    }

    //create name for room
    let randString = randomstring.generate(7);
    let unique_call_id = randomstring.generate(7);

    let callDetailData = new calldetailModel({
        schedule_name: randString,
        consumer_id: req.user._id,
        astrologer_id: req.body.astrologer_id,
        consumer_name: consumerData.unique_name,
        astrologer_name: astrologerData.unique_name,
        call_audio_video: 'audio',
        call_started: true,
        unique_call_id: unique_call_id
    });

    callDetailData.save((err, calldet) => {

        console.log('makeVoiceCall callDetailData :', err, calldet);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update details.',
                error: true
            });
        }

        astrologerData.astrologer_status = 'busy';
        astrologerData.save((err, astroData) => {

            console.log('makeVoiceCall astroData :', err, astroData);

            if (err) {
                return res.status(200).json({
                    title: 'Something went wrong when trying to update details.',
                    error: true
                });
            }

            notificationController.sendAstrologerStatus(astroData)

            console.log('makeVoiceCall sendAstrologerStatus :');

            let options = {
                'method': 'POST',
                'url': 'https://kpi.knowlarity.com/Basic/v1/account/call/makecall',
                'headers': {
                    'x-api-key': process.env.knowlarityAPIKey,
                    'Content-Type': 'application/json',
                    'Authorization': process.env.knowlarityAuth,
                },
                body: JSON.stringify({
                    'k_number': '+917829499511',
                    'agent_number': '+91' + consumerData.mobile,
                    'customer_number': '+91' + astrologerData.mobile,
                    'caller_id': '+918035338024',
                    'additional_params': {
                        'total_call_duration': call_time_sec,
                        'unique_id': unique_call_id
                    }
                })
            };

            console.log('\n\n\n\n\n\n\n\n MakeVoiceCall options :', options);

            request(options, async (error, response, data) => {

                console.log('\n\n\n\n\n\n\n\n MakeVoiceCall error :', error);
                console.log('\n\n\n\n\n\n\n\n MakeVoiceCall data :', data);

                if (error) {
                    return res.status(200).json({
                        error: true,
                        title: error
                    })
                }
                else if (data) {

                    calldet.call_uuid = 'data.success.call_id';

                    calldet.save((err, calldetails) => {
                        if (err) {
                            return res.status(200).json({
                                title: 'error occured in call details',
                                error: false
                            });
                        }

                        console.log('call audio err :', err, calldet);

                        // CANCEL ALL CONSUMER'S SENT REQS & ASTROLOGER'S RECEIVED REQS 
                        // SEND CANCELLED MSG TO CONSUMER & MISSED MSG TO ASTROLOGER
                        let autoCancelData = {
                            consumer_id: {
                                _id: consumerData._id
                            },
                            astrologer_id: {
                                _id: astrologerData._id
                            }
                        };

                        chatController.autoCancelRequest(autoCancelData);

                        let currentTime = new Date(Date.now());
                        let schedulerTime = new Date(currentTime.getTime() + 20000);

                        console.log('call audio currentTime :', currentTime, schedulerTime);

                        let randString = randomstring.generate(7);
                        let newEndSession = new chatSessionModel({
                            schedule_name: randString + 'missed_call',
                            call_id: calldet._id,
                            schedule_type: 'missed_call',
                            start_date: schedulerTime
                        })

                        newEndSession.save((err, sessiondata) => {
                            let endCall = nodeSchedule.scheduleJob(randString + 'missed_call', schedulerTime, () => {
                                calldetailModel
                                    .findOne({ _id: calldet._id })
                                    .exec(function (err, initCallDetails) {
                                        console.log('call audio completed initCallDetails ', err, initCallDetails);

                                        if (initCallDetails.room_status == 'no_status') {

                                            initCallDetails.call_started = false
                                            initCallDetails.save((err, initCallDetailsSaved) => {

                                                console.log('makeVoiceCall initCallDetails ', err, initCallDetailsSaved);

                                                astrologerData.astrologer_status = 'online'
                                                astrologerData.save((err, astroDataSaved) => {

                                                    console.log('makeVoiceCall astrologerData ', err, astroDataSaved);

                                                })
                                            })
                                        }
                                    })

                                //cancel schedule
                                let myScheduleJob = nodeSchedule.scheduledJobs[randString + 'missed_call'];
                                console.log('makeVoiceCall sessionData end_chat ', myScheduleJob);
                                if (myScheduleJob != undefined) {
                                    myScheduleJob.cancel();
                                }

                                chatSessionModel.deleteMany({ call_id: calldet._id }, function (error, data) {
                                    console.log('makeVoiceCall deleteMany ', error, data);
                                });
                            })
                        })

                        return res.status(200).json({
                            title: 'Call initiated',
                            data: calldet,
                            token: voiceToken,
                            error: false
                        });
                    })

                }
            })

        })
    })

}

module.exports = {
    getAstrologerStatus,
    makeVoiceCall,
    callListing,
    makeCall,
    tokenGenerator,
    voiceCallback,
    makeVideoCall,
    videoCallback,
    endVoiceCall,
    handleDialCallStatus,
    endVideoCall,
    makeVoiceCallNew
}