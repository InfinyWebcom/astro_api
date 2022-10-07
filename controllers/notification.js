/* NODE MODULES */
const FCM = require('fcm-push');
const async = require('async');

/* MODELS */
const notificationModel = require('../models/notification');
const userModel = require('../models/user');
const helper = require('../lib/helper');

/* GLOBAL CONSTANTS */
const fcmServerKey = process.env.fcmServerKey;
const fcm = new FCM(fcmServerKey);

/* 
# parameters: token
*/
const sendNotification = async (data) => {

    console.log('sendNotification data ==== ', data);

    data.flag = data.data.flag;
    data.title = 'AstroWize';
    data.vibrate = [100, 50, 100];
    data.body = data.msg;
    data.sound = "default";

    if (data.msg_type == "chat") {
        data.sound = "incoming.wav";
    }

    var message = {
        registration_ids: data.device_token,
        priority: "high",
        forceshow: true, // required fill with device token or topics
        collapse_key: 'AstroWize',
        content_available: true,
        data: data.data,
        // notification: {
        //     title: data.data.flag,//data.title,
        //     body: data.msg,
        //     sound: "default"
        // }
    };

    let userData = await userModel.getUserFromQuery({ _id: data.data.user_id });
    console.log('sendNotification get userData', userData)
    if (userData.device_type == 'ios') {
        message.notification = {
            title: data.data.flag,
            body: data.msg,
            sound: "default"
        }
    }

    if (data.data.flag != 'Testing') {
        notificationModel.addNotification(data.data, (error, response) => {
            console.log('add notification', error, response)
        })

        userModel.findOneAndUpdate({ _id: data.data.user_id }, { $inc: { notification_count: 1 } }, { new: true })
            .exec((err, userData) => {
                if (err) {
                    console.log('sendNotification userData err==== ', err);
                }
                console.log('sendNotification userData ==== ', userData);
            });
    }

    fcm.send(message, function (err, response) {
        if (err) {
            console.log('sendNotification err ==== ', data.data.flag, data.msg, err);
        } else {
            console.log('sendNotification response ==== ', response);
        }
    });

}

/* 
# parameters: token
# purpose: List notifications
*/
const notificationListing = async (req, res) => {
    console.log('notificationListing req.body ', req.body);

    let data = await notificationModel.getNotifications(req);
    console.log('notificationListing data ', data);

    userModel.findOneAndUpdate({ _id: req.user._id }, { $set: { notification_count: 0 } }, { new: true })
        .exec((err, userData) => {
            if (err) {
                console.log('notificationListing userData err==== ', err);
            }
            console.log('notificationListing userData ==== ', userData);
        });

    let isData = data.length == 0 ? false : true
    return res.status(200).json({
        title: 'Notification listing',
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0,
    })
}

/* 
# parameters: token
# purpose: To read all notifications
*/
const readNotifcations = async (req, res) => {
    console.log('notificationListing req.body ', req.body);
    console.log('notificationListing req.user ', req.user);

    userModel.findOneAndUpdate({ _id: req.user._id }, { $set: { notification_count: 0 } }, { new: true })
        .exec((err, userData) => {
            if (err) {
                console.log('sendNotification userData err==== ', err);
            }
            console.log('sendNotification userData ==== ', userData);

            return res.status(200).json({
                title: 'Notification listing',
                error: false,
                data: userData
            });
        });
}

/* 
# parameters: token
# purpose: To silent notifications
*/
const sendSilentNotification = (data) => {
    console.log('sendSilentNotification data ', data);

    var message = {
        registration_ids: data.device_token,
        priority: "high",
        collapse_key: 'Astrowize',
        content_available: true,
        data: data.data
    };

    fcm.send(message, function (err, response) {
        if (err) {
            console.log('sendSilentNotification err ', err);
        } else {
            console.log('sendSilentNotification response ', response);
        }
    });
}

/* 
# parameters: token
# purpose: To send astrologer status to all consumers using silent notifications
*/
const sendAstrologerStatus = async (astrologer) => {
    let data = await userModel.getSubscribeConsumers()  //get all consumers in listing screen

    async.eachOfSeries(data, function (consumer, key, cb) {
        //to consumer
        var msgSub = astrologer.first_name.charAt(0).toUpperCase() + astrologer.first_name.slice(1) + ' is ' + astrologer.astrologer_status + ' now'
        let consData = {
            msg: msgSub,
            title: "",
            device_token: consumer.device_token,
            data: {
                message: msgSub,
                flag: "Astrologer Status",
                astrologer_id: astrologer._id,
                astrologer_status: astrologer.astrologer_status
            }
        }

        consData.data.user_id = consumer._id
        consData.data.sec_user_id = astrologer._id
        sendSilentNotification(consData)

        //mail to consumer
        let referMsgBody = msgSub;
        let referMailData = {
            email: consumer.email,
            subject: 'Astrologer Status',
            body:
                '<p>' + referMsgBody
        };
        helper.sendEmail(referMailData)

        cb()
    }, function (err) {
        console.log('sendAstrologerStatus done--------', err);
    })
}

module.exports = {
    sendNotification,
    notificationListing,
    readNotifcations,
    sendSilentNotification,
    sendAstrologerStatus
}