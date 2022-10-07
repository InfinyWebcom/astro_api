/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
const fetch = require('node-fetch');
var fs = require('fs')
var moment = require('moment');
const nodeSchedule = require('node-schedule');

/* Models */
const chatModel = require('../models/chat');
const userModel = require('../models/user');
const messageModel = require('../models/message');
const chatSessionModel = require('../models/chatSession');
const transModel = require('../models/transaction');
const calldetailModel = require('../models/calldetail');

/* Twilio */
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const ChatGrant = AccessToken.ChatGrant;
const client = new twilio(process.env.accountSid, process.env.authToken);

const accessToken = new AccessToken(
    process.env.accountSid,
    process.env.API_KEY_SID,
    process.env.API_KEY_SECRET
);
const VideoGrant = AccessToken.VideoGrant;

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');
const miniChatBalance = 1//4   //to min balnce needed to initaite chat
const autoCloseConsumer = 10//4 //autoclose consumer if astrologer is not responding
const chatIdleTime = 5//2   //send notification to consumer if astrologer not replying for 5 min idle time.
const missedChatTime = 5//3   //request will be missed in 5 minutes if no replay from astrologer
const endChatConsumer = 10//4 //autoclose consumer if he is not responding for 10 minutes
const serviceRequestController = require('../controllers/serviceRequest');

/*
# parameters: token
# purpose: To send chat request to astrologer
*/
const sendChatRequest = async (req, res) => {
    console.log('sendChatRequest req.body ', req.body);
    console.log('sendChatRequest req.user ', req.user);

    const result = validationResult(req);
    console.log('sendChatRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let astrologer = await userModel.getUserFromQuery({ _id: req.body.astrologer_id });
    console.log('sendChatRequest astrologerData ', astrologer);

    if (!astrologer) {
        return res.status(200).json({
            title: 'Astrologer not found',
            error: true
        })
    }
    if (astrologer.astrologer_status == 'busy') {
        return res.status(200).json({
            title: "This astrologer is busy with another consumer.",
            error: true,
            data: astrologer
        });
    }
    var astrologer_rate = astrologer.client_chat_rate
    var consumer_wallet = req.user.wallet_balance

    var call_time_sec = 60 / (astrologer_rate / consumer_wallet)
    var call_time_min = 0
    if (call_time_sec > 60) {
        call_time_min = call_time_sec / 60
        call_time_sec = call_time_sec % 60
    }

    var msg = "Your wallet balance is insufficient for making this chat. This astrologer charges ₹" + astrologer_rate + " per minute."

    //minimum 60 seconds
    if (consumer_wallet < (astrologer_rate * miniChatBalance)) {
        return res.status(200).json({
            title: msg,
            error: true
        });
    }

    var chatInfo = new chatModel({
        consumer_id: req.user._id,
        astrologer_id: req.body.astrologer_id,
        request_status: "Pending"
    });

    console.log('chatInfo========', chatInfo);

    var channel_name = randomstring.generate(7);

    client.chat.services(process.env.CHAT_SERVICE_SID)
        .channels
        .create({
            uniqueName: channel_name,
            friendlyName: 'Astrowize',
            preWebhookUrl: process.env.baseUrl + '/chat/chatCallback',
            postWebhookUrl: process.env.baseUrl + '/chat/chatCallback',
            webhookMethod: 'POST',
            webhookFilters: ['onMessageSent', 'onMessageSend', 'onMessageUpdate', 'onMessageUpdated', 'onMessageRemove', 'onMessageRemoved', 'onMemberAdd', 'onMemberAdded', 'onMemberRemove', 'onMemberRemoved', 'onUserUpdate', 'onUserUpdated', 'onMediaMessageSend', 'onMediaMessageSent']
        })
        .then(channel => {
            chatInfo.channel_name = channel_name
            chatInfo.channel_id = channel.sid

            async.waterfall([
                function (firstCallback) {
                    //create user
                    client.chat.services(process.env.CHAT_SERVICE_SID)
                        .users
                        .create({ identity: astrologer.unique_name })
                        .then(user => {
                            console.log('chat astrologer_id created id', user.sid)
                            return firstCallback(null, false, "astrologer created");
                        })
                        .catch(e => {
                            console.error('Got an error in astrologer_id:', e.code, 'e.message: ', e.message)

                            return firstCallback(null, false, "astrologer exists");
                        });
                },
                function (err, payAmount, secCallback) {
                    //create user
                    client.chat.services(process.env.CHAT_SERVICE_SID)
                        .users
                        .create({ identity: req.user.unique_name })
                        .then(user => {
                            console.log('chat consumer_id created id', user.sid)
                            return secCallback(null, "consumer created")
                        })
                        .catch(e => {
                            console.error('Got an error in consumer_id:', e.code, 'e.message: ', e.message)

                            return secCallback(null, "consumer exists")
                        });
                }
            ], function (err, savedChat) {
                chatInfo.save((err, chatData) => {
                    console.log('chatInfo err========', err, chatData);

                    if (err) {
                        return res.status(200).json({
                            title: 'error in saving chat details',
                            error: true
                        });
                    }
                    /*
                    //to astrologer
                    var msg = "Knock Knock! There's a customer at the door willing to chat with you. Accept before they leave."
                    let astrologerData = {
                        msg: msg,
                        targetedScreen: 'online_notification',
                        title: "",
                        device_token: astrologer.device_token,
                        data: {
                            message: msg,
                            flag: "Chat Request",
                            chat_id: chatData._id,
                            msg_type: "chat"
                        }
                    }
                    astrologerData.data.user_id = req.body.astrologer_id
                    astrologerData.data.sec_user_id = req.user._id

                    notificationController.sendNotification(astrologerData)

                    //send mail to astrologer
                    let mailData = {
                        email: astrologer.email,
                        subject: 'AstroWize - New chat request!',
                        body:
                            "<p>" +
                            "Hello " + astrologer.first_name + "," +
                            "<p>" +
                            "A customer has made a chat request with you. Click here before they leave." +
                            "<p>" +
                            "Regards," +
                            "<br>" +
                            "Team AstroWize"
                    };
                    helper.sendEmail(mailData)
                    */
                    chatData
                        .populate('astrologer_id')
                        .populate('consumer_id')
                        .populate({
                            path: 'astrologer_id',
                            populate: {
                                path: 'subscribed_users.consumer_id'
                            }
                        })
                        .execPopulate()
                        .then(function (populatedChat) {

                            let curTime = new Date(Date.now());

                            console.log('reuest chat curTime', curTime);
                            let missedChatEndTime = new Date(curTime.getTime() + missedChatTime * 60 * 1000);
                            console.log('reuest chat missedChatEndTime', missedChatEndTime);

                            //to end chat if balance is less
                            var randString = randomstring.generate(7);
                            var newEndSession = new chatSessionModel({
                                schedule_name: randString + "missed_chat",
                                chat_id: chatData._id,
                                schedule_type: "missed_chat",
                                start_date: missedChatEndTime
                            })

                            newEndSession.save((err, sessiondata) => {
                                console.log('chatCallback missedChatEndTime========', err, sessiondata);

                                var endChatSch = nodeSchedule.scheduleJob(randString + "missed_chat", missedChatEndTime, function () {
                                    console.log('reuest chat missedChatEndTime inside');

                                    //to consumer
                                    let consData = populatedChat.consumer_id;
                                    var msg = populatedChat.astrologer_id.first_name + " is not available for chat.";
                                    let consumerData = {
                                        msg: msg,
                                        title: "",
                                        device_token: consData.device_token,
                                        data: {
                                            targetedScreen: 'chat_screen',
                                            message: msg,
                                            flag: "Chat Missed",
                                            chat_id: populatedChat._id,
                                            msg_type: "chat"
                                        }
                                    }
                                    consumerData.data.user_id = populatedChat.consumer_id._id
                                    consumerData.data.sec_user_id = populatedChat.astrologer_id._id

                                    notificationController.sendNotification(consumerData)

                                    //to astrologer
                                    var astroMsg = 'You missed the chat request from ' + populatedChat.consumer_id.first_name.charAt(0).toUpperCase() + populatedChat.consumer_id.first_name.slice(1);
                                    let astroData = {
                                        msg: astroMsg,
                                        title: "",
                                        device_token: populatedChat.astrologer_id.device_token,
                                        data: {
                                            message: astroMsg,
                                            flag: "Chat Missed",
                                            msg_type: "chat"
                                        }
                                    }
                                    astroData.data.user_id = populatedChat.astrologer_id._id
                                    astroData.data.sec_user_id = populatedChat.consumer_id._id
                                    notificationController.sendNotification(astroData)

                                    client.chat.services(process.env.CHAT_SERVICE_SID)
                                        .channels(populatedChat.channel_id)
                                        .remove()
                                        .then(channel => {
                                            console.log('deleteMissedChat missedChatEndTime channel deletd========', channel);
                                        })

                                    chatModel
                                        .findOneAndUpdate({ '_id': populatedChat._id, request_status: "Requested" },
                                            { $set: { "request_status": "Missed" } }, { new: true, useFindAndModify: false })
                                        .exec((err, data) => {
                                            console.log('deleteMissedChat missedChatEndTime err ', err);
                                            console.log('deleteMissedChat missedChatEndTime data ', data);
                                        })

                                    //cancel schedule            
                                    var myScheduleJob = nodeSchedule.scheduledJobs[randString + "missed_chat"];
                                    console.log('deleteMissedChat missedChatEndTime end_chat ', myScheduleJob);
                                    if (myScheduleJob != undefined) {
                                        myScheduleJob.cancel();
                                    }

                                    chatSessionModel.findOneAndDelete({ chat_id: populatedChat._id, schedule_type: "missed_chat" }, function (error, data) {

                                    });
                                })
                            })
                            return res.status(200).json({
                                title: "Chat request sent successfully",
                                error: false,
                                data: populatedChat
                            })
                        })
                })
            })
        })
}

/*
# parameters: token
# purpose: To accept chat request
*/
const acceptChatRequest = async (req, res) => {
    console.log('acceptChatRequest req.body ', req.body);
    console.log('acceptChatRequest req.user ', req.user);

    const result = validationResult(req);
    console.log('sendChatRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let chatData = await chatModel.getChatById(req);
    console.log('acceptChatRequest astrologerData ', chatData);
    if (!chatData) {
        return res.status(200).json({
            title: 'Chat not found',
            error: true
        })
    }

    chatData.request_status = "Accepted"

    //change astrologer status to busy
    chatData.astrologer_id.astrologer_status = 'busy'
    chatData.astrologer_id.save((err, astroData) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update details.',
                error: true
            });
        }

        //saving start time
        chatData.start_time = new Date()
        chatData.save((err, chatdata) => {
            console.log('chatInfo err========', err, chatdata);

            if (err) {
                return res.status(200).json({
                    title: 'error in saving chat details',
                    error: true
                });
            }

            //to consumer
            let consData = chatData.consumer_id;
            var msg = "Chat time! Your personal astrologer has approved your chat request. Click here to connect with them";
            let consumerData = {
                msg: msg,
                title: "",
                device_token: consData.device_token,
                data: {
                    targetedScreen: 'chat_screen',
                    message: msg,
                    flag: "Chat Accepted",
                    channel_id: channel.sid,
                    chat_id: chatdata._id,
                    msg_type: "chat"
                }
            }
            consumerData.data.user_id = chatData.consumer_id._id
            consumerData.data.sec_user_id = chatData.astrologer_id._id

            notificationController.sendNotification(consumerData)

            //send mail to consumer
            let mailData = {
                email: chatData.consumer_id.email,
                subject: 'AstroWize - Chat request accepted!',
                body:
                    "<p>" +
                    "Hello " + chatData.consumer_id.first_name + "," +
                    "<p>" +
                    "This is to inform you that your personal astrologer has accepted your chat request. Please login to the Astrowize app to connect with them." +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData)

            chatdata
                .populate('astrologer_id')
                .populate('consumer_id')
                .populate({
                    path: 'astrologer_id',
                    populate: {
                        path: 'subscribed_users.consumer_id'
                    }
                })
                .execPopulate()
                .then(function (populatedChat) {

                    console.log('getLastAstrologerMessage populatedChat---', populatedChat);
                    //to end chat if 5 min idle
                    var newSession = new chatSessionModel({
                        chat_id: populatedChat._id
                    })

                    newSession.save((err, sessiondata) => {
                        console.log('getLastAstrologerMessage sessiondata========', err, sessiondata);
                    })

                    const chatInterval = setInterval(function () {
                        messageModel.getLastAstrologerMessage(populatedChat, 2, (astroChatData) => {
                            console.log('getLastAstrologerMessage err========', err, astroChatData);

                            if (!astroChatData) {    //if no message available for astrologer, then end chat
                                endChatProcess(populatedChat, 'acceptapi', res, function (status, userData) {
                                    console.log('getLastAstrologerMessage end--', err, chatdata);

                                    clearInterval(chatInterval);
                                    chatSessionModel.findOneAndDelete({ chat_id: populatedChat._id }, function (error, data) {

                                    });
                                })
                            }
                            else if (astroChatData.chat_id.request_status == "Completed") {
                                clearInterval(chatInterval);

                                chatSessionModel.findOneAndDelete({ chat_id: astroChatData.chat_id._id }, function (error, data) {

                                });
                            }
                            else {
                                messageModel.getLastConsumerMessage(populatedChat, 2, (consChatData) => {
                                    if (!consChatData) { //if no message available for consumer, then end chat
                                        endChatProcess(populatedChat, 'acceptapi', res, function (status, userData) {
                                            console.log('getLastAstrologerMessage end--', err, chatdata);

                                            clearInterval(chatInterval);
                                            chatSessionModel.findOneAndDelete({ chat_id: populatedChat._id }, function (error, data) {

                                            });
                                        })
                                    } else if (consChatData.chat_id.request_status == "Completed") {
                                        clearInterval(chatInterval);

                                        chatSessionModel.findOneAndDelete({ chat_id: astroChatData.chat_id._id }, function (error, data) {

                                        });
                                    }
                                })
                            }
                        })
                    }, 60000);

                    return res.status(200).json({
                        title: "Chat request accepted syccessfully",
                        error: false,
                        data: populatedChat
                    })
                })
        })
    })
}

/*
# parameters: token
# purpose: To deny chat request
*/
const denyChatRequest = async (req, res) => {
    console.log('denyChatRequest req.body ', req.body);
    console.log('denyChatRequest req.user ', req.user);

    const result = validationResult(req);
    console.log('denyChatRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let chatData = await chatModel.getChatById(req);
    console.log('acceptChatRequest astrologerData ', chatData);
    if (!chatData) {
        return res.status(200).json({
            title: 'Chat not found',
            error: true
        })
    }

    // get session
    let sessiondata = await chatSessionModel.getSessionByType(chatData, "missed_chat")
    console.log('denyChatRequest sessiondata astrologer ', sessiondata);
    if (sessiondata) {
        //cancel schedule            
        var myScheduleJob = nodeSchedule.scheduledJobs[sessiondata.schedule_name];
        console.log('denyChatRequest accepted end_chat ', myScheduleJob);
        if (myScheduleJob != undefined) {
            myScheduleJob.cancel();
        }
        chatSessionModel.findOneAndDelete({ chat_id: chatData._id, schedule_type: "missed_chat" }, function (error, data) {
            console.log('denyChatRequest accepted data ', data);
        });
    }

    client.chat.services(process.env.CHAT_SERVICE_SID)
        .channels(chatData.channel_id)
        .members(chatData.consumer_member_id)
        .remove()
        .then(member => {
            console.log('denyChatRequest channel member========', member);

            client.chat.services(process.env.CHAT_SERVICE_SID)
                .channels(chatData.channel_id)
                .remove()
                .then(channel => {
                    console.log('denyChatRequest channel deletd========', channel);
                })

            chatData.request_status = "Declined"
            chatData.end_reason = "Declined by astrologer"

            chatData.save((err, chatdata) => {
                console.log('denyChatRequest err========', err, chatdata);

                if (err) {
                    return res.status(200).json({
                        title: 'error in saving chat details',
                        error: true
                    });
                }

                //to consumer
                let consData = chatData.consumer_id;
                var msg = 'Ouch! This is to inform you that ' + chatData.astrologer_id.first_name.charAt(0).toUpperCase() + chatData.astrologer_id.first_name.slice(1) + ' has denied your chat request. Please try again later.'
                let consumerData = {
                    msg: msg,
                    title: "",
                    device_token: consData.device_token,
                    data: {
                        targetedScreen: 'chat_history',
                        message: msg,
                        flag: "Chat Declined"
                    }
                }
                consumerData.data.user_id = chatData.consumer_id._id
                consumerData.data.sec_user_id = chatData.astrologer_id._id

                notificationController.sendNotification(consumerData)

                //send mail to consumer
                let msgBody = chatData.astrologer_id.first_name.charAt(0).toUpperCase() + chatData.astrologer_id.first_name.slice(1) + ' has denied your chat request. Please try again later.';


                let mailData = {
                    email: chatData.consumer_id.email,
                    subject: 'AstroWize - Chat request denied!',
                    body:
                        "<p>" +
                        "Hello " + chatData.consumer_id.first_name + "," +
                        "<p>" +
                        msgBody +
                        "<p>" +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };

                helper.sendEmail(mailData)

                return res.status(200).json({
                    title: "Request accepted successfully",
                    error: false,
                    data: chatdata
                })
            })
        })
}

/*
# parameters: token
# purpose: To get chat list
*/
const chatListing = async (req, res) => {
    console.log('chatListing req.body -- ', req.body);
    console.log('chatListing req.user---', req.user)

    let data = await chatModel.getChats(req);
    let isData = data.length == 0 ? false : true

    if (req.body.request_status != "Requested") {
        req.body.request_status = "Requested"
        let requestData = await chatModel.getChats(req);

        return res.status(200).json({
            title: 'Chats listing',
            error: false,
            data: isData ? data[0].data : [],
            requested_count: requestData.length,
            total_count: isData ? data[0].totalCount : 0
        });
    }
    return res.status(200).json({
        title: 'Chats listing',
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    });
}

/*
# parameters: token
# purpose: To get chat token
*/
const getChatToken = (req, res, cb) => {
    console.log('getChatToken req.query ', req.query, req.body);
    const appName = 'TwilioChat';

    var identity = req.query.identity ? req.query.identity : req.body.identity

    if (req.body.environment == 'DEBUG') {
        pushCredSid = process.env.TestPushCredSid;
    } else {
        pushCredSid = process.env.LivePushCredSid;
    }
    // Create a "grant" which enables a client to use Chat as a given user
    const chatGrant = new ChatGrant({
        serviceSid: process.env.CHAT_SERVICE_SID,
        pushCredentialSid: pushCredSid //'CRc535bd8367d23972ee1db0463038b4b6'
    });

    // Create an access token which we will sign and return to the client,
    // containing the grant we just created
    const token = new AccessToken(
        process.env.accountSid,
        process.env.API_KEY_SID,
        process.env.API_KEY_SECRET,
        {ttl: 82100}
    );

    token.addGrant(chatGrant);
    token.identity = identity;

    console.log('getChatToken identity ', identity);

    return res.json({
        identity: identity,
        token: token.toJwt(),
    });
}

/*
# parameters: token
# purpose: To get chat token
*/
const deleteChannel = (req, res, cb) => {
    console.log('deleteChannel req.body ', req.body);

    client.chat.services(process.env.CHAT_SERVICE_SID)
        .channels(req.body.channel_id)
        .remove()
        .then(channel => console.log('deleteChannel channel', channel))

    /*
     client.chat.services(process.env.CHAT_SERVICE_SID)
     .channels('CH5987c026f5e34af2bc13b416721b9f72')
            .media('ME122e4f6d524e6cc979506729c56b24f5')
            .fetch()
            .then(message => console.log(message.to));*/
    /*
    let url = "https://mcs.us1.twilio.com/v1/Services/IS932e43e6ccfe4dadb3def88e5255a9bf/Media/ME157ad37bd87322f01207a787d60b4d75"
    
    const headers = {
        "Authorization": `Basic QUM4YTljOGFkMTdjYzZmZjg2OWQ4ZGRhNjdjODgxMTE4NzpmZjVjZmUwOGQxNmY4YzEyOGI5OGVjMTZiMDcwMjEwZA==`,
        "Content-Type": 'application/json'
    }

    fetch(url, { method: 'GET', headers: headers })
        .then((response) => {
            return response.json()
        })
        .then((result) => {
            console.log('deleteChannel result', result);

            return result
        })
        */
    /*
     client.chat.services(process.env.CHAT_SERVICE_SID)
     .channels
     .create({
         friendlyName: 'channel_name',
         webhookMethod: 'POST'
     })
     .then(channel => {
             console.log('deleteChannel req.body ', req.body);
     })*/
    /*
   client.chat.services(process.env.CHAT_SERVICE_SID)
       .channels(req.body.channel_id)
       .update({
           friendlyName: 'Astrowize',
           uniqueName: '8WOQNkA'
       })
       .then(channel => console.log(channel.friendlyName));

   /*
    client.chat.services(process.env.CHAT_SERVICE_SID)
    .update({
        preWebhookUrl: 'https://5d70a39ee065.ngrok.io/chat/chatCallback',
        postWebhookUrl: 'https://5d70a39ee065.ngrok.io/chat/chatCallback',
        webhookMethod: 'POST',
        webhookFilters: ['onMessageSent', 'onMessageSend', 'onMessageUpdate', 'onMessageUpdated', 'onMessageRemove', 'onMessageRemoved', 'onChannelAdd', 'onChannelAdded', 'onChannelDestroy', 'onChannelDestroyed', 'onChannelUpdate', 'onChannelUpdated', 'onMemberAdd', 'onMemberAdded', 'onMemberRemove', 'onMemberRemoved', 'onUserUpdate', 'onUserUpdated'],
        webhookEnabled: true
    })
    .then(service => console.log(service.friendlyName));
    */
    /*
    client.chat.services(process.env.CHAT_SERVICE_SID)
        .channels(req.body.channel_id)
        .members
        .create({ identity: 'avanish' })
        .then(member => console.log(member.sid));

    
    client.chat.services(process.env.CHAT_SERVICE_SID)
           .channels('CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
           .webhooks
           .create({type: 'webhook'})
           .then(webhook => console.log(webhook.sid));
    */
    /*
    client.chat.services(process.env.CHAT_SERVICE_SID)
    .update({
        webhookFilters: ['onMessageSent', 'onMessageSend', 'onMessageUpdate', 'onMessageUpdated', 'onMessageRemove', 'onMessageRemoved', 'onChannelAdd', 'onChannelAdded', 'onChannelDestroy', 'onChannelDestroyed', 'onChannelUpdate', 'onChannelUpdated', 'onMemberAdd', 'onMemberAdded', 'onMemberRemove', 'onMemberRemoved', 'onUserUpdate', 'onUserUpdated']
    })
    .then(service => console.log(service.friendlyName));
    */
}

/*
# parameters: token
# purpose: To check inacive user status
*/
const checkInactiveStatus = async (chatData, populatedChat) => {
    console.log('chatCallback populatedChat========', populatedChat);

    const chatInterval = setInterval(function () {
        //auto close in 10 min if no msg from astrologer
        messageModel.getLastAstrologerMessageNew(populatedChat, autoCloseConsumer, (astroChat) => {
            console.log('chatCallback astroChat err========', astroChat);
            //auto close in 10 min if no msg from consumer
            messageModel.getLastConsumerMessageNew(populatedChat, endChatConsumer, (consumerChat) => {
                console.log('chatCallback consumerChat err========', consumerChat);

                messageModel.getLastChannelMessage(populatedChat, endChatConsumer, (channelChat) => {
                    console.log('getLastChannelMessage channelChat--', channelChat);

                    var auto_inactive_user = ""
                    if (!astroChat && !consumerChat) {
                        if (channelChat) {
                            if (channelChat.from_id.toString() == populatedChat.astrologer_id._id.toString()) {
                                console.log('getLastChannelMessage astrologer_id--');

                                auto_inactive_user = "consumer"
                            }
                            else {
                                console.log('getLastChannelMessage consumer_id--');

                                auto_inactive_user = "astrologer"
                            }
                        }
                    }
                    else if (!astroChat) {
                        auto_inactive_user = "astrologer"
                    }
                    else if (!consumerChat) {
                        auto_inactive_user = "consumer"
                    }

                    console.log('getLastChannelMessage auto_inactive_user--', auto_inactive_user);

                    if (auto_inactive_user == "astrologer") {
                        populatedChat.end_reason = "astrologer not replying for 10 min"
                        endChatProcess(populatedChat, 'acceptapi', undefined, undefined, function (status, chatdata) {
                            console.log('chatCallback astroChat end--', chatdata);

                            clearInterval(chatInterval);
                            chatSessionModel.deleteMany({ chat_id: populatedChat._id }, function (error, data) {

                            });
                        })
                    }
                    else if (auto_inactive_user == "consumer") {
                        populatedChat.end_reason = "consumer not replying for 10 min"
                        endChatProcess(populatedChat, 'acceptapi', undefined, undefined, function (status, chatdata) {
                            console.log('chatCallback consumerChat end--', chatdata);

                            clearInterval(chatInterval);
                            chatSessionModel.deleteMany({ chat_id: populatedChat._id }, function (error, data) {

                            });
                        })
                    }
                    else {
                        var dateFive = new Date();
                        dateFive.setMinutes(dateFive.getMinutes() - chatIdleTime);
                        console.log('chatCallback else dateFive========', dateFive);

                        messageModel.getLastAstrologerMessage(populatedChat, chatIdleTime, (astroChatData) => {
                            console.log('chatCallback astroChatData========', astroChatData);
                            console.log('chatCallback astroChatData.createdAt --- ', astroChatData.createdAt, astroChatData.chat_id.accepted_time);

                            messageModel.getLastConsumerMessage(populatedChat, chatIdleTime, (consChatData) => {
                                console.log('chatCallback consChatData========', consChatData);
                                console.log('chatCallback consChatData.createdAt --- ', consChatData.createdAt, consChatData.chat_id.accepted_time);

                                var inactive_user = ""
                                if ((consChatData.createdAt < dateFive && dateFive >= consChatData.chat_id.accepted_time) && astroChatData.createdAt < dateFive) {
                                    console.log('chatCallback if inactive_user');
                                    if (consChatData.createdAt > astroChatData.createdAt) { //astrologer is inactive
                                        console.log('chatCallback if if inactive_user');
                                        inactive_user = "astrologer"
                                    }
                                    else {
                                        console.log('chatCallback if else inactive_user');
                                        inactive_user = "consumer"
                                    }
                                }
                                else if (consChatData.createdAt < dateFive && dateFive >= consChatData.chat_id.accepted_time) {
                                    console.log('chatCallback else if inactive_user');
                                    inactive_user = "consumer"
                                }
                                else if (astroChatData.createdAt < dateFive) {
                                    console.log('chatCallback else else inactive_user');

                                    inactive_user = "astrologer"
                                }

                                if (inactive_user == "astrologer") {
                                    var req = {}
                                    req.body = {}
                                    req.body.ChannelSid = populatedChat.channel_id
                                    req.body.complated_that = "astrologer"

                                    chatModel.getChatByChannelId(req, (chatDetail) => {
                                        if (chatDetail && chatDetail.request_status == "Completed") {
                                            clearInterval(chatInterval);

                                            chatSessionModel.deleteMany({ chat_id: chatDetail._id }, function (error, data) {

                                            });
                                        }
                                        else if (chatDetail && chatDetail.consumer_id.is_chat_listing == true) {
                                            console.log('chatCallback populatedChat if========', chatDetail.consumer_id.is_chat_listing);

                                            //to consumer
                                            let consData = chatData.consumer_id;
                                            var msg = chatData.astrologer_id.first_name + ' is not replying. Do you want to end this chat?'

                                            let consumerData = {
                                                msg: msg,
                                                title: "",
                                                device_token: consData.device_token,
                                                data: {
                                                    targetedScreen: 'chat_screen',
                                                    message: msg,
                                                    flag: "Chat Idle",
                                                    chat_id: chatData._id
                                                }
                                            }
                                            consumerData.data.user_id = chatData.consumer_id._id
                                            consumerData.data.sec_user_id = chatData.astrologer_id._id
                                            notificationController.sendSilentNotification(consumerData)
                                        }
                                        else {
                                            console.log('chatCallback populatedChat else ========', chatDetail.consumer_id.is_chat_listing);
                                            populatedChat.end_reason = "astrologer not replying for 5 min"
                                            endChatProcess(populatedChat, 'acceptapi', undefined, undefined, function (status, chatdata) {
                                                console.log('chatCallback end--', chatdata);

                                                clearInterval(chatInterval);
                                                chatSessionModel.deleteMany({ chat_id: populatedChat._id }, function (error, data) {

                                                });
                                            })
                                        }
                                    })
                                }
                                if (inactive_user == "consumer") {
                                    var req = {}
                                    req.body = {}
                                    req.body.ChannelSid = populatedChat.channel_id
                                    req.body.complated_that = "astrologer"

                                    chatModel.getChatByChannelId(req, (chatDetail) => {
                                        if (chatDetail && chatDetail.request_status == "Completed") {
                                            clearInterval(chatInterval);

                                            chatSessionModel.deleteMany({ chat_id: chatDetail._id }, function (error, data) {

                                            });
                                        }
                                        else if (chatDetail && chatDetail.consumer_id.is_chat_listing == true) {
                                            console.log('chatCallback populatedChat else if========', chatDetail.consumer_id.is_chat_listing);

                                            //to consumer
                                            let consData = chatData.consumer_id;
                                            var msg = 'You have been inactive for more than ' + chatIdleTime + ' minutes. Do you want to end this chat?'

                                            let consumerData = {
                                                msg: msg,
                                                title: "",
                                                device_token: consData.device_token,
                                                data: {
                                                    targetedScreen: 'chat_screen',
                                                    message: msg,
                                                    flag: "Chat Idle",
                                                    chat_id: chatData._id
                                                }
                                            }
                                            consumerData.data.user_id = chatData.consumer_id._id
                                            consumerData.data.sec_user_id = chatData.astrologer_id._id
                                            notificationController.sendSilentNotification(consumerData)
                                        }
                                        else {
                                            populatedChat.end_reason = "consumer not replying for 5 min"
                                            endChatProcess(populatedChat, 'acceptapi', undefined, undefined, function (status, chatdata) {
                                                console.log('chatCallback end--', chatdata);

                                                clearInterval(chatInterval);
                                                chatSessionModel.deleteMany({ chat_id: populatedChat._id }, function (error, data) {

                                                });
                                            })
                                        }
                                    })
                                }
                            })
                        })
                    }
                })
            })
        })
    }, 60000);
}

/*
# parameters: token
# purpose: To get chat token
*/
const chatCallback = async (req, res, cb) => {
    res.sendStatus(200)
    console.log('chatCallback req.body ', req.body);
    /*
    req.body = {
        ChannelSid: 'CH50ade785d3dd473a8e7220ddf573ab3f',
        ClientIdentity: 'c8mJEfp',
        RetryCount: '0',
        EventType: 'onMessageSend',
        InstanceSid: 'IS932e43e6ccfe4dadb3def88e5255a9bf',
        Attributes: '{}',
        DateCreated: '2020-10-09T08:01:24.813Z',
        From: 'c8mJEfp',
        To: 'CHf16c57f872d4404c8ec1200dbfb468f2',
        Body: 'kggjgi Gujjula',
        AccountSid: 'AC8a9c8ad17cc6ff869d8dda67c8811187',
        Source: 'SDK'
      }
      */
    if (req.body.EventType == "onMessageSend" || req.body.EventType == "onMediaMessageSend") {
        let chatData = await chatModel.getChatByChannelId(req);
        console.log('chatCallback onMessageSend ', chatData);

        var from_id = ""
        var to_id = ""

        if (chatData.astrologer_id.unique_name == req.body.ClientIdentity) {
            var astrologer_rate = chatData.astrologer_id.client_chat_rate
            var consumer_wallet = chatData.consumer_id.wallet_balance

            //minimum 60 seconds
            if (consumer_wallet < (astrologer_rate * miniChatBalance)) {
                var consumerMsg = "Your wallet balance is insufficient for making this chat. This astrologer charges ₹" + astrologer_rate + " per minute."
                //to consumer
                let consumerData = {
                    msg: consumerMsg,
                    title: "",
                    device_token: chatData.consumer_id.device_token,
                    data: {
                        targetedScreen: 'chat_screen',
                        message: consumerMsg,
                        flag: "Less Balance",
                        channel_id: req.body.ChannelSid,
                        chat_id: chatData._id
                    }
                }
                consumerData.data.user_id = chatData.consumer_id._id
                consumerData.data.sec_user_id = chatData.astrologer_id._id
                notificationController.sendNotification(consumerData)

                //to astrologer
                var astrlogerMsg = 'Consumer has low balance for this chat'
                let astrologerData = {
                    msg: astrlogerMsg,
                    title: "",
                    device_token: chatData.astrologer_id.device_token,
                    data: {
                        targetedScreen: 'chat_screen',
                        message: astrlogerMsg,
                        flag: "Less Balance",
                        channel_id: req.body.ChannelSid,
                        chat_id: chatData._id
                    }
                }
                astrologerData.data.user_id = chatData.astrologer_id._id
                astrologerData.data.sec_user_id = chatData.consumer_id._id
                notificationController.sendNotification(astrologerData)

                return
            }

            if (chatData.request_status == "Requested") {
                chatData.request_status = "Accepted"
                chatData.accepted_time = new Date()

                //to consumer
                let consData = chatData.consumer_id;
                var msg = "Chat time! Your personal astrologer has approved your chat request. Click here to connect with them";
                let consumerData = {
                    msg: msg,
                    title: "",
                    device_token: consData.device_token,
                    data: {
                        targetedScreen: 'chat_screen',
                        message: msg,
                        flag: "Chat Accepted",
                        channel_id: chatData.channel_id,
                        chat_id: chatData._id,
                        msg_type: "chat"
                    }
                }
                consumerData.data.user_id = chatData.consumer_id._id
                consumerData.data.sec_user_id = chatData.astrologer_id._id
                notificationController.sendNotification(consumerData)


                let sessiondata = await chatSessionModel.getSessionByType(chatData, "missed_chat")
                console.log('deleteMissedChat sessiondata ', sessiondata);
                if (sessiondata) {
                    //cancel schedule            
                    var myScheduleJob = nodeSchedule.scheduledJobs[sessiondata.schedule_name];
                    console.log('deleteMissedChat accepted end_chat ', myScheduleJob);
                    if (myScheduleJob != undefined) {
                        myScheduleJob.cancel();
                    }
                    chatSessionModel.findOneAndDelete({ chat_id: chatData._id, schedule_type: "missed_chat" }, function (error, data) {

                    });
                }

                //change astrologer status to busy
                chatData.astrologer_id.astrologer_status = 'busy'
                chatData.astrologer_id.save((err, astroData) => {
                    console.log('chatCallback astrologer_id err========', err, astroData);

                    if (err) {

                    }

                    //saving start time
                    chatData.start_time = new Date()
                    chatData.save((err, chatdata) => {
                        console.log('chatCallback chatInfo err========', err, chatdata);

                        if (err) {

                        }
                        chatdata
                            .populate('astrologer_id')
                            .populate('consumer_id')
                            .populate({
                                path: 'astrologer_id',
                                populate: {
                                    path: 'subscribed_users.consumer_id'
                                }
                            })
                            .execPopulate()
                            .then(function (populatedChat) {

                                console.log('chatCallback populatedChat---', populatedChat);

                                let curTime = new Date(Date.now());

                                console.log('chatCallback curTime', curTime);
                                var call_time_sec = 60 / (astrologer_rate / consumer_wallet)
                                let endTimeConsumer = new Date(curTime.getTime() + parseInt(parseInt(call_time_sec) * 1000));
                                console.log('chatCallback call_time_sec', call_time_sec, endTimeConsumer);

                                //to end chat if balance is less
                                var randString = randomstring.generate(7);
                                var newEndSession = new chatSessionModel({
                                    schedule_name: randString + "end_chat",
                                    chat_id: populatedChat._id,
                                    schedule_type: "end_chat",
                                    start_date: endTimeConsumer
                                })

                                newEndSession.save((err, sessiondata) => {
                                    console.log('chatCallback newEndSession========', err, sessiondata);

                                    var endChatSch = nodeSchedule.scheduleJob(randString + "end_chat", endTimeConsumer, function () {
                                        populatedChat.end_reason = "wallet balance is less"
                                        endChatProcess(populatedChat, 'acceptapi', res, req, function (status, chatdata) {
                                            console.log('chatCallback newEndSession end--', chatdata);

                                            clearInterval(chatInterval);

                                            chatSessionModel.deleteMany({ chat_id: populatedChat._id }, function (error, data) {

                                            });
                                        })
                                    })

                                    //before 2 min warning
                                    let endTimeWarnConsumer = new Date(curTime.getTime() + parseInt(parseInt(call_time_sec) * 1000 - 120000));
                                    console.log('chatCallback endTimeWarnConsumer', endTimeWarnConsumer);

                                    var newWarnSession = new chatSessionModel({
                                        schedule_name: randString + "end_chat_warn",
                                        chat_id: populatedChat._id,
                                        schedule_type: "end_chat_warn",
                                        start_date: endTimeWarnConsumer,
                                    })

                                    newWarnSession.save((err, sessiondata) => {
                                        console.log('chatCallback newWarnSession========', err, sessiondata);

                                        var endChatWarnSch = nodeSchedule.scheduleJob(randString + "end_chat_warn", endTimeWarnConsumer, function () {
                                            //to consumer
                                            let consData = chatData.consumer_id;
                                            var msg = 'This chat will end in 2 minutes'

                                            let consumerData = {
                                                msg: msg,
                                                title: "",
                                                device_token: consData.device_token,
                                                data: {
                                                    targetedScreen: 'chat_screen',
                                                    message: msg,
                                                    flag: "Chat Warning",
                                                    chat_id: populatedChat._id
                                                }
                                            }
                                            consumerData.data.user_id = chatdata.consumer_id._id
                                            consumerData.data.sec_user_id = chatdata.astrologer_id._id
                                            notificationController.sendNotification(consumerData)
                                        })

                                        //to end chat if 5 min idle
                                        var newSession = new chatSessionModel({
                                            schedule_name: randString,
                                            chat_id: populatedChat._id,
                                            schedule_type: "chat_idle",
                                            start_date: new Date()
                                        })

                                        newSession.save((err, sessiondata) => {
                                            console.log('chatCallback sessiondata========', err, sessiondata);
                                        })
                                    })
                                })

                                //status
                                checkInactiveStatus(chatData, populatedChat)
                            })

                        autoCancelRequest(chatData)
                    })
                })
            }

            from_id = chatData.astrologer_id._id
            to_id = chatData.consumer_id._id

            //to consumer
            var msg = 'Message received from ' + chatData.astrologer_id.first_name.charAt(0).toUpperCase() + chatData.astrologer_id.first_name.slice(1);

            let consumerData = {
                msg: msg,
                title: "",
                device_token: chatData.consumer_id.device_token,
                data: {
                    message: msg,
                    flag: "Message Received",
                    channel_id: req.body.ChannelSid,
                    msg_type: "chat"
                }
            }
            consumerData.data.user_id = chatData.consumer_id._id
            consumerData.data.sec_user_id = chatData.astrologer_id._id

            notificationController.sendNotification(consumerData)

            //cancell all the other requests
        }
        if (chatData.consumer_id.unique_name == req.body.ClientIdentity) {
            if (chatData.request_status == "Pending") {
                chatData.request_status = "Requested"

                chatData.save((err, chatdata) => {
                    console.log('chatCallback Pending err========', err, chatdata);

                    if (err) {

                    }

                    //to astrologer
                    var msg = "Knock Knock! There's a customer at the door willing to chat with you. Accept before they leave."
                    let astrologerData = {
                        msg: msg,
                        targetedScreen: 'online_notification',
                        title: "",
                        device_token: chatData.astrologer_id.device_token,
                        data: {
                            message: msg,
                            flag: "Chat Request",
                            chat_id: chatData._id,
                            msg_type: "chat"
                        }
                    }
                    astrologerData.data.user_id = chatData.astrologer_id._id
                    astrologerData.data.sec_user_id = chatData.consumer_id._id

                    notificationController.sendNotification(astrologerData)

                    //send mail to astrologer
                    let mailData = {
                        email: chatData.astrologer_id.email,
                        subject: 'AstroWize - New chat request!',
                        body:
                            "<p>" +
                            "Hello " + chatData.astrologer_id.first_name + "," +
                            "<p>" +
                            "A customer has made a chat request with you. Click here before they leave." +
                            "<p>" +
                            "Regards," +
                            "<br>" +
                            "Team AstroWize"
                    };
                    helper.sendEmail(mailData)
                })
            }

            //to astrologer
            var msg = 'Message received from ' + chatData.consumer_id.first_name.charAt(0).toUpperCase() + chatData.consumer_id.first_name.slice(1);
            let astrologerData = {
                msg: msg,
                title: "",
                device_token: chatData.astrologer_id.device_token,
                data: {
                    message: msg,
                    flag: "Message Received",
                    channel_id: req.body.ChannelSid,
                    msg_type: "chat"
                }
            }
            astrologerData.data.user_id = chatData.astrologer_id._id
            astrologerData.data.sec_user_id = chatData.consumer_id._id
            notificationController.sendNotification(astrologerData)

            //get from and to
            to_id = chatData.astrologer_id._id
            from_id = chatData.consumer_id._id

            chatData.consumer_id.is_chat_listing = true
            chatData.consumer_id.save()
        }

        if (req.body.EventType == "onMediaMessageSend") {

            var media_url = process.env.twilio_media_base_url + "/Services/" + process.env.CHAT_SERVICE_SID + "/Media/" + req.body.MediaSid
            console.log('media_url is....', media_url);

            const headers = {
                "Authorization": `Basic QUM4YTljOGFkMTdjYzZmZjg2OWQ4ZGRhNjdjODgxMTE4NzpmZjVjZmUwOGQxNmY4YzEyOGI5OGVjMTZiMDcwMjEwZA==`,
                "Content-Type": 'application/json'
            }
            fetch(media_url, { method: 'GET', headers: headers })
                .then((response) => {
                    return response.json()
                })
                .then(async (result) => {
                    console.log('chatCallback result', result);

                    if (result) {
                        const response = await fetch(result.links.content_direct_temporary);
                        const buffer = await response.buffer();

                        console.log('onMediaMessageSend response ', response)
                        console.log('onMediaMessageSend buffer ', buffer)

                        let dir = './assets/chats/';
                        helper.createDir(dir);
                        var picName = randomstring.generate({
                            length: 8,
                            charset: 'alphanumeric'
                        });
                        var abs = ""
                        var fileName = ""
                        var message_type = ""
                        if (req.body.MediaContentType == "image/jpeg") {
                            abs = dir + picName + '.jpg';
                            fileName = '/chats/' + picName + '.jpg'
                            message_type = "image"
                        }
                        if (req.body.MediaContentType == "application/pdf") {
                            abs = dir + picName + '.pdf';
                            fileName = '/chats/' + picName + '.pdf'
                            message_type = "pdf"
                        }
                        console.log('signup abs ', abs)

                        fs.writeFile(abs, buffer, function (err) {
                            if (err) {
                                console.log("chatCallback image write error", err);
                            }
                            console.log("chatCallback image write success", err);
                        });

                        var newMessage = new messageModel({
                            message: chatData.Body,
                            chat_id: chatData._id,
                            message_type: message_type,
                            mediaSid: req.body.MediaSid,
                            from_id: from_id,
                            to_id: to_id,
                            media_url: fileName
                        })
                        newMessage.save((err, msgData) => {
                            console.log('chatCallback msgData err========', err, msgData);

                            if (err) {

                            }
                        })
                    }
                })
        }
        else {
            var newMessage = new messageModel({
                message: req.body.Body,
                chat_id: chatData._id,
                message_type: "text",
                from_id: from_id,
                to_id: to_id,
            })
            newMessage.save((err, chatdata) => {
                console.log('chatCallback chatInfo err========', err, chatdata);

                if (err) {

                }
            })
        }
    }

    if (req.body.EventType == "onMemberAdded") {
        let chatData = await chatModel.getChatByChannelId(req);
        console.log('chatCallback onMessageSend ', chatData);

        if (chatData.astrologer_id.unique_name == req.body.ClientIdentity) {
            chatData.astrologer_member_id = req.body.MemberSid

            chatData.save((err, savedChat) => {
                console.log('chatCallback onMemberAdd astrologer_id err========', err, savedChat);

                if (err) {

                }
            })
        }
        if (chatData.consumer_id.unique_name == req.body.ClientIdentity) {
            chatData.consumer_member_id = req.body.MemberSid

            chatData.save((err, savedChat) => {
                console.log('chatCallback onMemberAdd consumer_id err========', err, savedChat);

                if (err) {

                }
            })
        }
    }

}
/*
# parameters: token
# purpose: To auto cancel if call, chat started
*/
const autoCancelRequest = async (chatData, cb) => {

    console.log('autoCancelRequest chatData--- ', chatData);

    //send cancelled msg to consmers
    chatModel.getChatByAstrologerId(chatData, (chatlist) => {
        if (chatlist) {
            async.eachOfSeries(chatlist, function (chatDetail, key, cb) {
                (async () => {
                    //to consumer
                    var msg = 'Your request has been cancelled by ' + chatDetail.astrologer_id.first_name.charAt(0).toUpperCase() + chatDetail.astrologer_id.first_name.slice(1);

                    let consData = {
                        msg: msg,
                        title: "",
                        device_token: chatDetail.consumer_id.device_token,
                        data: {
                            message: msg,
                            flag: "Chat Cancelled",
                            msg_type: "chat"
                        }
                    }
                    consData.data.user_id = chatDetail.consumer_id._id
                    consData.data.sec_user_id = chatDetail.astrologer_id._id

                    notificationController.sendNotification(consData)

                    //get session
                    let sessiondata = await chatSessionModel.getSessionByType(chatDetail, "missed_chat")
                    console.log('autoCancelRequest sessiondata astrologer ', sessiondata);
                    if (sessiondata) {
                        //cancel schedule            
                        var myScheduleJob = nodeSchedule.scheduledJobs[sessiondata.schedule_name];
                        console.log('autoCancelRequest accepted end_chat ', myScheduleJob);
                        if (myScheduleJob != undefined) {
                            myScheduleJob.cancel();
                        }
                        chatSessionModel.findOneAndDelete({ chat_id: chatDetail._id, schedule_type: "missed_chat" }, function (error, data) {

                        });
                    }
                    client.chat.services(process.env.CHAT_SERVICE_SID)
                        .channels(chatDetail.channel_id)
                        .members(chatDetail.consumer_member_id)
                        .remove()
                        .then(member => {
                            console.log('autoCancelRequest consumer_member_id========', member);
                        })

                    setTimeout(function () {
                        //remove channel after use
                        client.chat.services(process.env.CHAT_SERVICE_SID)
                            .channels(chatDetail.channel_id)
                            .remove()
                            .then(channel => {
                                console.log('autoCancelRequest channel deletd========', channel);
                            })
                    }, 1000);
                    cb()
                })()
            }, function (err) {
                console.log('autoCancelRequest astrologer done--------', err);

                //cancel all astrologer's other requests
                chatModel.updateMany({ astrologer_id: chatData.astrologer_id._id, request_status: "Requested" }, { request_status: "Cancelled_astrolger" })
                    .exec((err, saveData) => {
                        console.log('autoCancelRequest saveData err========', err, saveData);
                    })
            })
        }
    })

    //send missed msg to astrologers
    chatModel.getChatByConsumerId(chatData, (chatlist) => {
        if (chatlist) {
            async.eachOfSeries(chatlist, function (chatDetail, key, cb) {
                (async () => {
                    //to astrologer
                    var msg = 'You missed the chat request from ' + chatDetail.consumer_id.first_name.charAt(0).toUpperCase() + chatDetail.consumer_id.first_name.slice(1);
                    let astroData = {
                        msg: msg,
                        title: "",
                        device_token: chatDetail.astrologer_id.device_token,
                        data: {
                            message: msg,
                            flag: "Chat Missed",
                            msg_type: "chat"
                        }
                    }
                    astroData.data.user_id = chatDetail.astrologer_id._id
                    astroData.data.sec_user_id = chatDetail.consumer_id._id
                    notificationController.sendNotification(astroData)

                    //get session
                    let sessiondata = await chatSessionModel.getSessionByType(chatDetail, "missed_chat")
                    console.log('autoCancelRequest sessiondata astrologer ', sessiondata);
                    if (sessiondata) {
                        //cancel schedule            
                        var myScheduleJob = nodeSchedule.scheduledJobs[sessiondata.schedule_name];
                        console.log('autoCancelRequest accepted end_chat ', myScheduleJob);
                        if (myScheduleJob != undefined) {
                            myScheduleJob.cancel();
                        }
                        chatSessionModel.findOneAndDelete({ chat_id: chatDetail._id, schedule_type: "missed_chat" }, function (error, data) {

                        });
                    }
                    client.chat.services(process.env.CHAT_SERVICE_SID)
                        .channels(chatDetail.channel_id)
                        .members(chatDetail.consumer_member_id)
                        .remove()
                        .then(member => {
                            console.log('autoCancelRequest consumer_member_id========', member);
                        })

                    setTimeout(function () {
                        //remove channel after use
                        client.chat.services(process.env.CHAT_SERVICE_SID)
                            .channels(chatDetail.channel_id)
                            .remove()
                            .then(channel => {
                                console.log('autoCancelRequest channel deletd========', channel);
                            })
                    }, 1000);
                    cb()
                })()
            }, function (err) {
                console.log('autoCancelRequest consumer done--------', err);

                //cancel all consumer's other requests
                chatModel.updateMany({ consumer_id: chatData.consumer_id._id, request_status: "Requested" }, { request_status: "Declined" })
                    .exec((err, saveData) => {
                        console.log('autoCancelRequest saveData err========', err, saveData);
                    })
            })
        }
    })

}

/*
# parameters: token
# purpose: To caculate the chat rate update transaction 
*/
const endChatProcess = async (chatDetail, apiname, res, req, cb) => {
    console.log('endChatProcess chatDetail---', chatDetail);

    var chatreq = {}
    chatreq.body = {}
    chatreq.body.chat_id = chatDetail._id
    let chatData = await chatModel.getChatById(chatreq);

    if (chatData.request_status == "Completed") {
        if (apiname == "endapi") {
            return res.status(200).json({
                title: "Chat ended successfully",
                error: false,
                data: chatData
            })
        }
        return cb(chatData)
    }
    chatData.end_reason = chatDetail.end_reason
    chatData.request_status = "Completed"
    chatData.end_time = new Date()

    var end_time = new Date()

    // To calculate the time difference of two dates 
    var difference_time = end_time.getTime() - chatData.start_time.getTime();
    var difference_min = difference_time / (1000 * 60);
    console.log('endChatProcess difference_time', difference_time);
    console.log('endChatProcess difference_min', difference_min);

    let time = moment.duration(difference_time / 1000, 'seconds')
    console.log('endChatProcess time', time);
    //    var durationMin = moment.duration(difference_time, 'seconds') > 0 ? `${time.hours() > 0 ? time.hours() + ' hours' : ''} ${time.minutes() > 0 ? time.minutes() + ' minutes' : ''} ${time.seconds() > 0 ? time.seconds() + ' seconds' : ''}` : ''

    var durationMin = ""
    if (moment.duration(difference_time, 'seconds') > 0) {
        if (time.hours() == 1) {
            durationMin = durationMin + " " + time.hours() + " hour"
        }
        else if (time.hours() > 1) {
            durationMin = durationMin + " " + time.hours() + " hours"
        }
        if (time.minutes() == 1) {
            durationMin = durationMin + " " + time.minutes() + " minute"
        }
        else if (time.minutes() > 1) {
            durationMin = durationMin + " " + time.minutes() + " minutes"
        }
        if (time.seconds() == 1) {
            durationMin = durationMin + " " + time.seconds() + " second"
        }
        else if (time.seconds() > 1) {
            durationMin = durationMin + " " + time.seconds() + " seconds"
        }
    }

    console.log('endChatProcess durationMin', durationMin);

    var chat_rate = parseFloat(parseFloat(difference_min) * parseFloat(chatData.astrologer_id.chat_rate)).toFixed(2)
    var client_chat_rate = parseFloat(parseFloat(difference_min) * parseFloat(chatData.astrologer_id.client_chat_rate)).toFixed(2)

    console.log('endChatProcess chat_rate', chat_rate, client_chat_rate);

    //get chat rate from wallet
    if (chatData.consumer_id.wallet_balance - client_chat_rate >= 0) {
        chatData.consumer_id.wallet_balance = parseFloat(chatData.consumer_id.wallet_balance - client_chat_rate).toFixed(2)
    }
    else {
        //    chat_rate = chatData.consumer_id.wallet_balance
        client_chat_rate = chatData.consumer_id.wallet_balance
        chatData.consumer_id.wallet_balance = 0
    }

    chatData.chat_rate = chat_rate
    chatData.client_chat_rate = client_chat_rate
    chatData.chat_duration = difference_time / 1000 //duration in seconds
    chatData.save(async (err, chatdata) => {
        console.log('endChatProcess err========', err, chatdata);

        if (err && apiname == "endapi") {
            return res.status(200).json({
                title: 'error in saving chat details',
                error: true
            });
        }

        //change astrologer status
        chatData.astrologer_id.astrologer_status = 'online'

        chatData.astrologer_id.subscribed_users.forEach(function (value, i) {
            console.log('endChatProcess .subscribed_users forach--', i, value);

            chatData.astrologer_id.subscribed_users[i].notified = true
        });

        chatData.astrologer_id.save((err, data) => {
            console.log('endChatProcess in events forach', err, data);
            if (err) {

            }
        })

        //save consumer data
        chatData.consumer_id.is_chat_listing = false
        chatData.consumer_id.save((err, userData) => {
            console.log('endChatProcess in events userData', err, userData);

            if (err) {

            }
        })

        //stop chat schedules
        let chatSessions = await chatSessionModel.getSessionByChatId(chatData);
        console.log('endChatProcess getChatSessions ', chatSessions);

        async.eachOfSeries(chatSessions, function (sessionData, key, cb) {
            console.log('endChatProcess sessionData--------', sessionData);

            if (sessionData.schedule_type == "end_chat") {
                var myScheduleJob = nodeSchedule.scheduledJobs[sessionData.schedule_name];
                console.log('endChatProcess sessionData end_chat ', myScheduleJob);
                if (myScheduleJob != undefined) {
                    myScheduleJob.cancel();
                }
            }
            if (sessionData.schedule_type == "end_chat_warn") {
                var myScheduleJob = nodeSchedule.scheduledJobs[sessionData.schedule_name];
                console.log('endChatProcess sessionData end_chat_warn ', myScheduleJob);
                if (myScheduleJob != undefined) {
                    myScheduleJob.cancel();
                }
            }
            cb()
        }, function (err) {
            console.log('endChatProcess end schedules--------', err);
        })

        client.chat.services(process.env.CHAT_SERVICE_SID)
            .channels(chatData.channel_id)
            .members(chatData.astrologer_member_id)
            .remove()
            .then(member => {
                console.log('endChat chatData.astrologer_member_id========', member);
            })

        client.chat.services(process.env.CHAT_SERVICE_SID)
            .channels(chatData.channel_id)
            .members(chatData.consumer_member_id)
            .remove()
            .then(member => {
                console.log('endChat consumer_member_id========', member);
            })

        setTimeout(function () {
            //remove channel after use
            client.chat.services(process.env.CHAT_SERVICE_SID)
                .channels(chatData.channel_id)
                .remove()
                .then(channel => {
                    console.log('endChat channel deletd========', channel);
                })
        }, 1000);

        chatSessionModel.deleteMany({ chat_id: chatData._id }, function (error, data) {

        });

        //to consumer
        let consData = chatData.consumer_id;

        var consumer_end_reason = " "
        if (chatdata.end_reason == "consumer_inactive_7_mins") {
            consumer_end_reason = " due to your inactivity for more than 7 minutes "
        }
        if (chatdata.end_reason == "astrologer_inactive_7_mins") {
            consumer_end_reason = " due to their inactivity for more than 7 minutes "
        }
        if (chatdata.end_reason == "astrologer not replying for 5 min") {
            consumer_end_reason = " due to their inactivity for more than 5 minutes "
        }
        if (chatdata.end_reason == "consumer not replying for 5 min") {
            consumer_end_reason = " due to your inactivity for more than 5 minutes "
        }
        if (chatdata.end_reason == "astrologer not replying for 10 min") {
            consumer_end_reason = " due to their inactivity for more than 10 minutes "
        }
        if (chatdata.end_reason == "consumer not replying for 10 min") {
            consumer_end_reason = " due to your inactivity for more than 10 minutes "
        }
        if (chatdata.end_reason == "wallet balance is less") {
            consumer_end_reason = " as your wallet balance is low "
        }

        var msg = "Session completed! Your chat session of" + durationMin + " with " + chatData.astrologer_id.first_name.charAt(0).toUpperCase() + chatData.astrologer_id.first_name.slice(1) + " has ended" + consumer_end_reason + "and ₹ " + client_chat_rate + " has been deducted from your Astrowize wallet." //parseFloat(parseFloat(difference_min).toFixed(2))

        let consumerData = {
            msg: msg,
            targetedScreen: 'wallet_screen',
            title: "",
            device_token: consData.device_token,
            data: {
                message: msg,
                flag: "Chat Completed",
                chat_id: chatData._id,
                end_reason: chatData.end_reason
            }
        }
        consumerData.data.user_id = chatData.consumer_id._id
        consumerData.data.sec_user_id = chatData.astrologer_id._id
        notificationController.sendNotification(consumerData)

        //send mail to consumer
        let mailData = {
            email: chatData.consumer_id.email,
            subject: 'AstroWize - Chat session completed!', //parseFloat(parseFloat(difference_min).toFixed(2))
            body:
                "<p>" +
                "Hello " + chatData.consumer_id.first_name + "," +
                "<p>" +
                "This is to inform you that your chat session of" + durationMin + " with " + chatData.astrologer_id.first_name.charAt(0).toUpperCase() + chatData.astrologer_id.first_name.slice(1) + " has ended" + consumer_end_reason + "and ₹ " + client_chat_rate + " has been deducted from your Astrowize wallet. Thank you for using our services." +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData)

        //sms to consumer
        var smsConsumerData = {}
        smsConsumerData.to = ['91' + chatData.consumer_id.mobile.replace(/\D/g, '')]
        smsConsumerData.template_id = "1707160828871132684"
        smsConsumerData.message = "Hello " + chatData.consumer_id.first_name + ",\nThis is to inform you that your chat session of" + durationMin + " with " + chatData.astrologer_id.first_name.charAt(0).toUpperCase() + chatData.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_chat_rate + " has been deducted from your AstroWize wallet. Thank you for using our services, FINOTO."
        let smsConsumer = helper.sendSMS(smsConsumerData)

        //to astrologer
        let astroData = chatData.astrologer_id;
        var astrologer_end_reason = " "
        if (chatdata.end_reason == "consumer_inactive_7_mins") {
            astrologer_end_reason = " due to their inactivity for more than 7 minutes "
        }
        if (chatdata.end_reason == "astrologer_inactive_7_mins") {
            astrologer_end_reason = " due to your inactivity for more than 7 minutes "
        }
        if (chatdata.end_reason == "astrologer not replying for 5 min") {
            astrologer_end_reason = " due to your inactivity for more than 5 minutes "
        }
        if (chatdata.end_reason == "consumer not replying for 5 min") {
            astrologer_end_reason = " due to their inactivity for more than 5 minutes "
        }
        if (chatdata.end_reason == "astrologer not replying for 10 min") {
            astrologer_end_reason = " due to your inactivity for more than 10 minutes "
        }
        if (chatdata.end_reason == "consumer not replying for 10 min") {
            astrologer_end_reason = " due to their inactivity for more than 10 minutes "
        }
        if (chatdata.end_reason == "wallet balance is less") {
            astrologer_end_reason = " as consumer's wallet balance is low "
        }

        var astroMsg = "Your chat session has ended" + astrologer_end_reason + "and the payment has been transferred to your registered account."
        let astrologerData = {
            msg: astroMsg,
            title: "",
            device_token: astroData.device_token,
            data: {
                message: astroMsg,
                chat_id: chatData._id,
                end_reason: chatData.end_reason,
                flag: "Chat Completed"
            }
        }
        astrologerData.data.user_id = chatData.astrologer_id._id
        astrologerData.data.sec_user_id = chatData.consumer_id._id
        notificationController.sendNotification(astrologerData)

        //send mail to astrologer
        let astroMailData = {
            email: chatData.astrologer_id.email,
            subject: ' Chat session completed',
            body:
                "<p>" +
                "Hello " + chatData.astrologer_id.first_name + "," +
                "<p>" +
                "Your chat session was successfully completed and the payment has been transferred to your registered account. Please rate our chat session. Thank you. " +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(astroMailData)

        //sms to astrologer
        var smsData = {}
        smsData.to = ['91' + chatData.astrologer_id.mobile.replace(/\D/g, '')]
        smsData.template_id = "1707160828881537711"
        smsData.message = "Hello " + chatData.astrologer_id.first_name + ",\nYour chat session was successfully completed and the payment has been transferred to your registered account. Click here to rate our chat session. Thanks, FINOTO."
        let sms = helper.sendSMS(smsData)

        //notify subscribed consumers about astrologer online
        console.log('endChat subscribed_users', chatData.astrologer_id.subscribed_users);
        if (chatData.astrologer_id.subscribed_users && chatData.astrologer_id.subscribed_users.length > 0) {
            let sub_consumers = chatData.astrologer_id.subscribed_users

            async.eachOfSeries(sub_consumers, function (consumer, key, eachcb) {
                //to consumer
                if (consumer.consumer_id) {
                    var msgSub = chatData.astrologer_id.first_name.charAt(0).toUpperCase() + chatData.astrologer_id.first_name.slice(1) + ' is online now'
                    let consData = {
                        msg: msgSub,
                        title: "",
                        device_token: consumer.consumer_id.device_token,
                        data: {
                            message: msgSub,
                            flag: "Astrologer Online",
                        }
                    }
                    consData.data.user_id = consumer.consumer_id._id
                    consData.data.sec_user_id = chatData.astrologer_id._id
                    notificationController.sendNotification(consData)

                    //send mail to consumer
                    let consumerMsgBody = msgSub
                    let consumerMailData = {
                        email: consumer.consumer_id.email,
                        subject: 'Astrologer Online',
                        body:
                            '<p>' + consumerMsgBody
                    };
                    helper.sendEmail(consumerMailData)
                }

                eachcb()
            }, function (err) {
                console.log('consumer done--------', err);
            })
        }

        //to save transaction
        var transData = new transModel({
            transaction_type: 'chat',
            consumer_id: chatData.consumer_id._id,
            payment_status: "success",
            chat_id: chatData._id,
            payment_type: "wallet",
            astrologer_id: chatData.astrologer_id._id,
            transaction_amt: chat_rate,
            client_transaction_amt: client_chat_rate
        })
        transModel.saveTransaction(transData, (err, savedData) => {
            console.log('endChat process in events savedData', err, savedData);

            if (apiname == "endapi") {
                if (chatdata.end_reason == "astrologer ended chat") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = "Astrologer has left the chat"
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = ""
                    }
                }
                if (chatdata.end_reason == "consumer ended chat") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = ""
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Consumer has left the chat"
                    }
                }
                if (chatdata.end_reason == "wallet balance is less") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = ""
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended as consumer's wallet balance is low"
                    }
                }
                if (chatdata.end_reason == "astrologer not accepted request") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = ""
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = ""
                    }
                }
                if (chatdata.end_reason == "astrologer not replying for 10 min") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to their inactivity for more than 10 minutes."
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to your inactivity for more than 10 minutes."
                    }
                }
                if (chatdata.end_reason == "consumer not replying for 10 min") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to your inactivity for more than 10 minutes."
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to their inactivity for more than 10 minutes."
                    }
                }
                if (chatdata.end_reason == "astrologer not replying for 5 min") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to their inactivity for more than 5 minutes."
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to your inactivity for more than 5 minutes."
                    }
                }
                if (chatdata.end_reason == "consumer not replying for 5 min") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to your inactivity for more than 5 minutes."
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to their inactivity for more than 5 minutes."
                    }
                }
                if (chatdata.end_reason == "consumer_inactive_7_mins") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to your inactivity for more than 7 minutes."
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to their inactivity for more than 7 minutes."
                    }
                }
                if (chatdata.end_reason == "astrologer_inactive_7_mins") {
                    if (req.user.user_type == "consumer") {
                        chatdata.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to their inactivity for more than 7 minutes."
                    }
                    if (req.user.user_type == "astrologer") {
                        chatdata.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to your inactivity for more than 7 minutes."
                    }
                }

                return res.status(200).json({
                    title: "Chat ended successfully",
                    error: false,
                    data: chatdata
                })
            }
            cb(chatdata)
        })
    })
}

/*
# parameters: token
# purpose: To end chat
*/
const endChat = async (req, res, cb) => {
    console.log('endChat req.query ', req.body);
    console.log('endChat req.user ', req.user);

    const result = validationResult(req);
    console.log('endChat errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let chatData = await chatModel.getChatById(req);
    console.log('endChat astrologerData ', chatData);

    if (!chatData) {
        return res.status(200).json({
            title: "Chat not found",
            error: true
        });
    }

    console.log('endChat subscribed_users ', chatData.astrologer_id.subscribed_users);
    console.log('endChat req.body.end_reason ', req.body.end_reason);

    if (req.body.end_reason != undefined && req.body.end_reason != "") {
        chatData.end_reason = req.body.end_reason
    }
    else if (req.user.user_type == "astrologer") {
        chatData.end_reason = "astrologer ended chat"
    }
    else if (req.user.user_type == "consumer") {
        chatData.end_reason = "consumer ended chat"
    }
    endChatProcess(chatData, 'endapi', res, req)
}

/*
# parameters: token
# purpose: To get chat details
*/
const chatDetails = async (req, res, cb) => {
    console.log('chatDetails req.query ', req.body);
    console.log('chatDetails req.user ', req.user);

    const result = validationResult(req);
    console.log('chatDetails errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let chatData = await chatModel.getChatById(req);
    console.log('chatDetails astrologerData ', chatData);

    if (!chatData) {
        return res.status(200).json({
            title: "Chat not found",
            error: true
        });
    }
    /*
    var dateThree = new Date();
    dateThree.setHours(dateThree.getHours() - 3);
    if (chatData.createdAt < dateThree) {
        chatData.request_status = "Missed"
    }*/

    if (chatData.end_reason == "astrologer ended chat") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = "Astrologer has left the chat"
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = ""
        }
    }
    if (chatData.end_reason == "consumer ended chat") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = ""
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Consumer has left the chat"
        }
    }
    if (chatData.end_reason == "wallet balance is less") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = ""
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended as consumer's wallet balance is low"
        }
    }
    if (chatData.end_reason == "astrologer not accepted request") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = ""
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = ""
        }
    }
    if (chatData.end_reason == "astrologer not replying for 10 min") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to their inactivity for more than 10 minutes."
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to your inactivity for more than 10 minutes."
        }
    }
    if (chatData.end_reason == "consumer not replying for 10 min") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to your inactivity for more than 10 minutes."
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to their inactivity for more than 10 minutes."
        }
    }
    if (chatData.end_reason == "astrologer not replying for 5 min") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to their inactivity for more than 5 minutes."
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to your inactivity for more than 5 minutes."
        }
    }
    if (chatData.end_reason == "consumer not replying for 5 min") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to your inactivity for more than 5 minutes."
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to their inactivity for more than 5 minutes."
        }
    }
    if (chatData.end_reason == "consumer_inactive_7_mins") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to your inactivity for more than 7 minutes."
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to their inactivity for more than 7 minutes."
        }
    }
    if (chatData.end_reason == "astrologer_inactive_7_mins") {
        if (req.user.user_type == "consumer") {
            chatData.end_reason = "Your chat with " + chatData.astrologer_id.first_name + " has ended due to their inactivity for more than 7 minutes."
        }
        if (req.user.user_type == "astrologer") {
            chatData.end_reason = "Your chat with " + chatData.consumer_id.first_name + " has ended due to your inactivity for more than 7 minutes."
        }
    }

    console.log('chatDetails astrologerData after ', chatData);

    return res.status(200).json({
        title: "Chat details",
        error: false,
        data: chatData
    })
}

/*
# parameters: token
# purpose: To get message list
*/
const messageListing = async (req, res, cb) => {
    console.log('messageListing req.query ', req.body);

    const result = validationResult(req);
    console.log('messageListing errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    let messages = await messageModel.getMessages(req);
    console.log('messageListing messages ', messages);

    return res.status(200).json({
        title: "Message list",
        error: false,
        data: messages
    })
}

/*
# parameters: token
# purpose: To get ongoing chat
*/
const getOngoingChat = async (req, res, cb) => {

    console.log('getOngoingChat req.query ', req.body);

    const result = validationResult(req);
    console.log('getOngoingChat errors ', result);

    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let data = await chatModel.getOngoingChat(req);
    console.log('getOngoingChat data ', data);

    if (data) {
        return res.status(200).json({
            title: "Ongoing chat",
            error: false,
            data: data,
            requested_data: [],
            call_data: null
        })
    }

    let call_data = await calldetailModel.getOngoingCallDetails(req)
    console.log('getOngoingCallDetails call_data ', call_data);

    req.body.request_status = "Requested"
    let requested_data = await chatModel.getOngoingChat(req);
    console.log('getOngoingChat requested_data ', requested_data);

    if (call_data) {
        if (call_data.call_audio_video == "video") {
            //accesstoken for employer
            accessToken.identity = call_data.astrologer_name;

            // Create a Video grant which enables a client to use Video 
            // and limits access to the specified Room (DailyStandup)
            const videoGrant = new VideoGrant({
                room: call_data.schedule_name
            });

            // Add the grant to the token
            accessToken.addGrant(videoGrant);

            console.log('getOngoingChat accessToken--- ', accessToken.toJwt());

            return res.status(200).json({
                title: "Ongoing chat",
                error: false,
                data: data,
                requested_data: requested_data,
                call_data: call_data,
                accessToken: accessToken.toJwt()
            })
        }
    }
    return res.status(200).json({
        title: "Ongoing chat",
        error: false,
        data: data,
        requested_data: requested_data,
        call_data: call_data
    })

}

/*
# parameters: token
# purpose: To end all chat if server error/restart
*/
const endChatOnRestart = async (/*req, res, cb*/) => {
    let chatSessions = await chatSessionModel.getChatSessions();
    console.log('endChatOnRestart chatSessions ', chatSessions);

    async.eachOfSeries(chatSessions, function (sessionData, key, cb) {
        console.log('endChatOnRestart sessionData--------', sessionData);

        var populatedChat = sessionData.chat_id

        console.log('endChatOnRestart sessionData.start_date--------', sessionData.start_date);
        var local = moment(sessionData.start_date).local()
        var dateObj = new Date(local)   //new Date(req.body.date);
        var month = dateObj.getMonth();     //months from 0-11
        var day = dateObj.getDate();
        var year = dateObj.getFullYear();
        var hour = dateObj.getHours();
        var minute = dateObj.getMinutes();
        var second = dateObj.getSeconds();

        var date = new Date(parseInt(year), parseInt(month), parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
        console.log('endChatOnRestart date--------', date);

        if (sessionData.schedule_type == "end_chat") {
            var endChatSch = nodeSchedule.scheduleJob(sessionData.schedule_name, date, function () {
                populatedChat.end_reason = "wallet balance is less"

                endChatProcess(populatedChat, 'acceptapi', undefined, undefined, function (status, chatdata) {
                    console.log('chatCallback newEndSession end--', chatdata);

                    chatSessionModel.deleteMany({ chat_id: populatedChat._id }, function (error, data) {

                    });
                })
            })
        }
        if (sessionData.schedule_type == "end_chat_warn") {
            var endChatWarnSch = nodeSchedule.scheduleJob(sessionData.schedule_name, date, function () {
                //to consumer
                let consData = populatedChat.consumer_id;
                var msg = 'This chat will end in 2 minutes'

                let consumerData = {
                    msg: msg,
                    title: "",
                    device_token: consData.device_token,
                    data: {
                        targetedScreen: 'chat_screen',
                        message: msg,
                        flag: "Chat Warning",
                        chat_id: sessionData.chat_id._id
                    }
                }
                consumerData.data.user_id = populatedChat.consumer_id._id
                consumerData.data.sec_user_id = populatedChat.astrologer_id._id
                notificationController.sendNotification(consumerData)
            })
        }
        if (sessionData.schedule_type == "missed_chat") {
            var endChatSch = nodeSchedule.scheduleJob(sessionData.schedule_name, date, function () {
                //to consumer
                let consData = populatedChat.consumer_id;
                var msg = populatedChat.astrologer_id.first_name + " is not available for chat.";
                let consumerData = {
                    msg: msg,
                    title: "",
                    device_token: consData.device_token,
                    data: {
                        targetedScreen: 'chat_screen',
                        message: msg,
                        flag: "Chat Missed",
                        chat_id: sessionData.chat_id._id
                    }
                }
                consumerData.data.user_id = populatedChat.consumer_id._id
                consumerData.data.sec_user_id = populatedChat.astrologer_id._id
                notificationController.sendNotification(consumerData)

                //to astrologer
                var astroMsg = 'You missed the chat request from ' + populatedChat.consumer_id.first_name.charAt(0).toUpperCase() + populatedChat.consumer_id.first_name.slice(1);
                let astroData = {
                    msg: astroMsg,
                    title: "",
                    device_token: populatedChat.astrologer_id.device_token,
                    data: {
                        message: astroMsg,
                        flag: "Chat Missed",
                        msg_type: "chat"
                    }
                }
                astroData.data.user_id = populatedChat.astrologer_id._id
                astroData.data.sec_user_id = populatedChat.consumer_id._id
                notificationController.sendNotification(astroData)

                client.chat.services(process.env.CHAT_SERVICE_SID)
                    .channels(sessionData.chat_id.channel_id)
                    .remove()
                    .then(channel => {
                        console.log('deleteMissedChat restart channel deletd========', channel);
                    })

                chatModel
                    .findOneAndUpdate({ '_id': sessionData.chat_id._id },
                        { $set: { "request_status": "Missed", "end_reason": "astrologer not accepted request" } }, { new: true, useFindAndModify: false })
                    .exec((err, data) => {
                        console.log('deleteMissedChat restart err ', err);
                        console.log('deleteMissedChat restart data ', data);
                    })

                //cancel schedule            
                var myScheduleJob = nodeSchedule.scheduledJobs[sessionData.schedule_name];
                console.log('deleteMissedChat restart end_chat ', myScheduleJob);
                if (myScheduleJob != undefined) {
                    myScheduleJob.cancel();
                }

                chatSessionModel.findOneAndDelete({ chat_id: sessionData.chat_id._id, schedule_type: "missed_chat" }, function (error, data) {

                });
            })
        }
        if (sessionData.schedule_type == "chat_idle") {
            //status
            checkInactiveStatus(populatedChat, populatedChat)
        }

        cb()
    }, function (err) {
        console.log('endChatOnRestart done--------', err);
    })
}

/*
# parameters: token
# purpose: To get end chat if balance is less when astrologer try to accept the chat request
*/
const endChatOnBalance = async (req, res, cb) => {
    console.log('endChatOnBalance req.query ', req.body);

    const result = validationResult(req);
    console.log('endChatOnBalance errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let chatData = await chatModel.getChatByChannelId(req);
    if (!chatData) {
        return res.status(200).json({
            title: "Chat not found",
            error: true
        });
    }

    var consumerMsg = "Your wallet balance is insufficient for making this chat. This astrologer charges ₹" + chatData.astrologer_id.client_chat_rate + " per minute."
    //to consumer
    let consumerData = {
        msg: consumerMsg,
        title: "",
        device_token: chatData.consumer_id.device_token,
        data: {
            targetedScreen: 'chat_screen',
            message: consumerMsg,
            flag: "Less Balance",
            channel_id: req.body.ChannelSid,
            chat_id: chatData._id
        }
    }
    consumerData.data.user_id = chatData.consumer_id._id
    consumerData.data.sec_user_id = chatData.astrologer_id._id
    notificationController.sendNotification(consumerData)

    chatData.request_status = "Missed"
    chatData.save((err, chatdata) => {
        console.log('endChatOnBalance err========', err, chatdata);

        if (err) {
            return res.status(200).json({
                title: 'error in saving chat details',
                error: true
            });
        }
        return res.status(200).json({
            title: "Chat",
            error: false,
            data: chatData
        })
    })
}

/*
# parameters: token
# purpose: To check whether consumer is on chat page or not
*/
const updateChatPage = async (req, res) => {
    console.log('updateChatPage req.body ', req.body);
    console.log('updateChatPage req.user ', req.user);

    const result = validationResult(req);
    console.log('updateChatPage errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    if (req.body.is_chat_listing == "false" || req.body.is_chat_listing == false) {
        console.log('updateChatPage req.body false');
        req.user.is_chat_listing = false
    }
    else {
        console.log('updateChatPage req.body true');
        req.user.is_chat_listing = true
    }

    req.user.save((error, savedUser) => {
        console.log('createOrder savedTrans---', error, savedUser)

        if (error) {
            return res.status(200).json({
                title: "Chat not found",
                error: true
            });
        }

        return res.status(200).json({
            title: "Chat screen",
            error: false,
            data: savedUser
        })
    })
}

/*
# parameters: token
# purpose: To cancel chat request
*/
const cancelChatRequest = async (req, res) => {
    console.log('cancelChatRequest req.body ', req.body);
    console.log('cancelChatRequest req.user ', req.user);

    const result = validationResult(req);
    console.log('cancelChatRequest errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let chatData = await chatModel.getChatById(req);
    console.log('cancelChatRequest astrologerData ', chatData);
    if (!chatData) {
        return res.status(200).json({
            title: 'Chat not found',
            error: true
        })
    }
    if (chatData.request_status != "Requested") {
        return res.status(200).json({
            title: 'You cannot cancel this chat',
            error: true
        })
    }

    let sessiondata = await chatSessionModel.getSessionByType(chatData, "missed_chat")
    console.log('cancelChatRequest sessiondata ', sessiondata);
    if (sessiondata) {
        //cancel schedule            
        var myScheduleJob = nodeSchedule.scheduledJobs[sessiondata.schedule_name];
        console.log('cancelChatRequest accepted end_chat ', myScheduleJob);
        if (myScheduleJob != undefined) {
            myScheduleJob.cancel();
        }
        chatSessionModel.findOneAndDelete({ chat_id: chatData._id, schedule_type: "missed_chat" }, function (error, data) {

        });
    }

    chatData.request_status = "Cancelled"
    chatData.save((err, chatdata) => {
        console.log('cancelChatRequest err========', err, chatdata);

        if (err) {
            return res.status(200).json({
                title: 'error in saving chat details',
                error: true
            });
        }

        client.chat.services(process.env.CHAT_SERVICE_SID)
            .channels(chatData.channel_id)
            .members(chatData.consumer_member_id)
            .remove()
            .then(member => {
                console.log('cancelChatRequest consumer_member_id========', member);
            })

        setTimeout(function () {
            //remove channel after use
            client.chat.services(process.env.CHAT_SERVICE_SID)
                .channels(chatData.channel_id)
                .remove()
                .then(channel => {
                    console.log('cancelChatRequest channel deletd========', channel);
                })
        }, 1000);

        //to astrologer
        var astrlogerMsg = 'Consumer has cancelled the request'
        let astrologerData = {
            msg: astrlogerMsg,
            title: "",
            device_token: chatData.astrologer_id.device_token,
            data: {
                targetedScreen: 'chat_history',
                message: astrlogerMsg,
                flag: "Chat Cancelled",
                chat_id: chatData._id
            }
        }
        astrologerData.data.user_id = chatData.astrologer_id._id
        astrologerData.data.sec_user_id = chatData.consumer_id._id
        notificationController.sendNotification(astrologerData)

        return res.status(200).json({
            title: "Request cancelled successfully",
            error: false,
            data: chatdata
        })
    })
}

const notifyServicePaymentRestart = async (req, res) => {

    let notifyServicePayments = await chatSessionModel.getNotifyServicePayments();

    console.log('\n\nNotifyServicePayments :-', notifyServicePayments);

    async.eachOfSeries(notifyServicePayments, (sessionData, key, cb) => {

        let serviceReq = sessionData.service_req_id;
        let local = moment(sessionData.start_date).local();
        let dateObj = new Date(local);
        let month = dateObj.getMonth();
        let day = dateObj.getDate();
        let year = dateObj.getFullYear();
        let hour = dateObj.getHours();
        let minute = dateObj.getMinutes();
        let second = dateObj.getSeconds();
        let date = new Date(parseInt(year), parseInt(month), parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));

        if (sessionData.schedule_type == 'notify_payment_twelve') {

            let remain_amt = serviceReq.remain_amt;
            let serviceTime = moment.tz(serviceReq.service_time, helper.getTimezone()).format('MMM DD, YYYY hh:mm a');

            let url = 'https://astrowize?request_id=' + serviceReq._id;
            consumerMailMsg = 'Your service has been assigned to: ' + serviceReq.astrologer_id.first_name + ' at: ' + serviceTime + '. <br><br>\n\nPlease ' + '<a href="' + url + '">click here</a>' + ' to pay the remaining amount ' + parseFloat(remain_amt).toFixed(2)
            consumerMsg = 'Your service has been assigned to: ' + serviceReq.astrologer_id.first_name + ' at: ' + serviceTime + '. Confirm this paying remaining amount ' + parseFloat(remain_amt).toFixed(2)
            consumerSmsMsg = 'Your service has been assigned to: ' + serviceReq.astrologer_id.first_name + ' at: ' + serviceTime + '. Please ' + url + ' to pay the remaining amount ' + parseFloat(remain_amt).toFixed(2)

            let notifyPaymentTwelve = nodeSchedule.scheduleJob(sessionData.schedule_name, date, () => {

                let msgTemp = { consumerMailMsg: consumerMailMsg, consumerMsg: consumerMsg, consumerSmsMsg: consumerSmsMsg, template_id: 'd3f7f376-c784-4fb5-b3d6-e6dbc70ca61f' }
                let req = { body: { request_id: serviceReq._id } }

                serviceRequestController.notifyServicePayment(req, msgTemp)

                // CANCEL SCHEDULE
                let myScheduleJob = nodeSchedule.scheduledJobs[sessionData.schedule_name];
                if (myScheduleJob != undefined) {
                    myScheduleJob.cancel();
                }

                chatSessionModel.deleteMany({ schedule_name: sessionData.schedule_name }, (error, data) => {
                    console.log('twelveEndSession deleteMany ', error, data);
                });

            })

        }
        if (sessionData.schedule_type == 'notify_payment_eighteen') {

            let remain_amt = serviceReq.remain_amt;
            let serviceTime = moment.tz(serviceReq.service_time, helper.getTimezone()).format('MMM DD, YYYY hh:mm a');

            let url = 'https://astrowize?request_id=' + serviceReq._id;
            consumerMailMsg = 'Your service has been assigned to: ' + serviceReq.astrologer_id.first_name + ' at: ' + serviceTime + '. <br><br>\n\nPlease ' + '<a href="' + url + '">click here</a>' + ' to pay the remaining amount ' + parseFloat(remain_amt).toFixed(2)
            consumerMsg = 'Your service has been assigned to: ' + serviceReq.astrologer_id.first_name + ' at: ' + serviceTime + '. Confirm this paying remaining amount ' + parseFloat(remain_amt).toFixed(2)
            consumerSmsMsg = 'Your service has been assigned to: ' + serviceReq.astrologer_id.first_name + ' at: ' + serviceTime + '. Please ' + url + ' to pay the remaining amount ' + parseFloat(remain_amt).toFixed(2)

            let notifyPaymentEighteen = nodeSchedule.scheduleJob(sessionData.schedule_name, date, () => {

                let msgTemp = { consumerMailMsg: consumerMailMsg, consumerMsg: consumerMsg, consumerSmsMsg: consumerSmsMsg, template_id: 'd3f7f376-c784-4fb5-b3d6-e6dbc70ca61f' }
                let req = { body: { request_id: serviceReq._id } }

                serviceRequestController.notifyServicePayment(req, msgTemp)

                // CANCEL SCHEDULE
                let myScheduleJob = nodeSchedule.scheduledJobs[sessionData.schedule_name];
                if (myScheduleJob != undefined) {
                    myScheduleJob.cancel();
                }

                chatSessionModel.deleteMany({ schedule_name: sessionData.schedule_name }, (error, data) => {
                    console.log('eighteenEndSession deleteMany ', error, data);
                });

            })

        }
        if (sessionData.schedule_type == 'cancel_service_req') {

            let notifyTwentyFour = nodeSchedule.scheduleJob(sessionData.schedule_name, date, () => {

                let req = { body: { request_id: serviceReq._id } }

                serviceRequestController.cancelServiceReqScheduler(req)

                // CANCEL SCHEDULE
                var myScheduleJob = nodeSchedule.scheduledJobs[sessionData.schedule_name];
                if (myScheduleJob != undefined) {
                    myScheduleJob.cancel();
                }

                chatSessionModel.deleteMany({ schedule_name: sessionData.schedule_name }, (error, data) => {
                    console.log('twentyfourEndSession deleteMany ', error, data);
                });

            })

        }

        cb()

    }, (err) => {
        console.log('notifyServicePayment done--------', err);
    })

}

module.exports = {
    sendChatRequest,
    acceptChatRequest,
    denyChatRequest,
    chatListing,
    getChatToken,
    chatCallback,
    deleteChannel,
    autoCancelRequest,
    endChat,
    chatDetails,
    messageListing,
    getOngoingChat,
    endChatOnRestart,
    endChatOnBalance,
    updateChatPage,
    cancelChatRequest,
    notifyServicePaymentRestart
}