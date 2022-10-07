/* NODE-MODULES */
const helper = require('../lib/helper');
const userModel = require('../models/user');
const calldetailModel = require('../models/calldetail');
const Knowlarity = require('../models/knowlarity');
const { check, validationResult, body } = require('express-validator');
const moment = require('moment');

const feeds = async (req, res) => {

    console.log('\n\nKnowlarityFeeds req.body :', req.body);

    if (req.headers.token && req.headers.token.trim().toLowerCase() === 'knowlarityserver2021!') {

        const result = validationResult(req);

        if (result.errors.length > 0) {
            return res.status(200).json({
                error: true,
                title: result.errors[0].msg,
                errors: result
            });
        }

        let dateString = req.body.call_date;
        let dateMomentObject = moment(dateString, "DD/MM/YYYY").add(5, 'hours').add(30, 'minute');
        let dateObject = dateMomentObject.toDate();

        let consumerData = await userModel.getUserFromQuery({ mobile: req.body.consumer_number.slice(5) });

        console.log('\n\nKnowlarityFeeds consumerData ID :', consumerData._id);
        console.log('\n\nKnowlarityFeeds consumerData :', consumerData);

        let durationInSeconds = countSeconds(req.body.call_duration);

        if (durationInSeconds > 0) {
            calldetailModel
                .findOne({ $and: [{ consumer_id: consumerData._id }, { call_started: true }] })
                .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
                .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url subscribed_users audio_rate client_audio_rate')
                .populate({
                    path: 'astrologer_id',
                    populate: {
                        path: 'subscribed_users.consumer_id'
                    }
                }).exec((err, calldet) => {
                    // processCallCompleted(calldet, durationInSeconds, durationInSeconds)
                })
        } else if (durationInSeconds == 0) {
            calldetailModel
                .findOne({ $and: [{ consumer_id: consumerData._id }, { call_started: true }] })
                .populate('consumer_id', '_id first_name last_name email mobile user_type device_token profile_url wallet_balance')
                .populate('astrologer_id', '_id first_name last_name email mobile user_type device_token profile_url')
                .exec((err, calldet) => {

                    calldetailModel.findOneAndUpdate({  $and: [{ consumer_id: consumerData._id }, { call_started: true }] }, { $set: { room_status: 'declined', call_started: false, caller_duration: 0, astrologer_duration: 0 } }, { new: true }).then((newData, err) => {
                        console.log('data in events busy err', err, newData);
                    })

                    calldet.astrologer_id.astrologer_status = 'online'
                    calldet.astrologer_id.save((err, data) => {
                        if (err) {

                        }
                    })
                })
        }

        helper.getTransactionId((error, transId) => {
            if (transId) {

                let know = new Knowlarity({
                    call_date: dateObject,
                    call_time: req.body.call_time,
                    consumer_number: req.body.consumer_number,
                    agent_number: req.body.agent_number,
                    call_duration: req.body.call_duration,
                    transaction_id: transId,
                    call_uuid: req.body.call_uuid,
                    extras: req.body.extras
                })

                know.save((err, data) => {
                    if (data) {
                        return res.status(200).json({
                            error: false,
                            title: 'Data saved successfully.',
                        })
                    } else {
                        return res.status(200).json({
                            error: true,
                            title: 'Failed to save data.',
                        })
                    }
                })
            }
        })

    } else {
        res.status(200).json({
            error: true,
            title: 'Invalid token.',
        })
    }

}

const countSeconds = (str) => {
    const [hh = '0', mm = '0', ss = '0'] = (str || '0:0:0').split(':');
    const hour = parseInt(hh, 10) || 0;
    const minute = parseInt(mm, 10) || 0;
    const second = parseInt(ss, 10) || 0;
    return (hour * 3600) + (minute * 60) + (second);
};

const processCallCompleted = (calldet, astrologer_duration, consumer_duration) => {

    calldet.room_status = 'success'
    calldet.call_started = false
    calldet.astrologer_duration = astrologer_duration
    calldet.consumer_duration = consumer_duration

    let targetedScreen = ''

    // call rate calculation
    let call_rate = 0
    let client_call_rate = 0

    call_rate = parseFloat(parseFloat(astrologer_duration / 60) * parseFloat(calldet.astrologer_id.audio_rate)).toFixed(2)
    client_call_rate = parseFloat(parseFloat(astrologer_duration / 60) * parseFloat(calldet.astrologer_id.client_audio_rate)).toFixed(2)
    targetedScreen = 'audio_listing'

    calldet.call_rate = call_rate
    calldet.client_call_rate = client_call_rate

    if (calldet.consumer_id.wallet_balance - client_call_rate >= 0) {
        calldet.consumer_id.wallet_balance = parseFloat(calldet.consumer_id.wallet_balance - client_call_rate).toFixed(2)
    }
    else {
        calldet.consumer_id.wallet_balance = 0
    }

    calldet.consumer_id.save((err, userData) => {
        if (err) {
        }
    })

    calldet.save((err, calldetails) => {
        if (err) {
        }
    })

    // to save transaction
    let transData = new transModel({
        transaction_type: 'audio',
        consumer_id: calldet.consumer_id._id,
        payment_status: 'success',
        call_id: calldet._id,
        payment_type: 'wallet',
        astrologer_id: calldet.astrologer_id._id,
        transaction_amt: call_rate,
        client_transaction_amt: client_call_rate
    });


    transModel.saveTransaction(transData, (err, savedData) => {
        if (err) {
        }
    })

    // change astrologer status
    calldet.astrologer_id.astrologer_status = 'online'

    // astrologer is online
    calldet.astrologer_id.save((err, data) => {
        if (err) {
        }
    })

    // sending notification call completed
    let msg = "Your voice call was successfully completed. Click here to rate our voice call services."

    // to astrologer
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

    // send mail to astrologer
    let msgBody = "Your call session with " + calldet.consumer_id.first_name.charAt(0).toUpperCase() + calldet.consumer_id.first_name.slice(1) + " was successfully completed. Click here to rate our voice call services."

    // to consumer
    let time = moment.duration(astrologer_duration, 'seconds')

    let durationMin = moment.duration(astrologer_duration, 'seconds') > 0 ? `${time.hours() > 0 ? time.hours() + ' hours' : ''} ${time.minutes() > 0 ? time.minutes() + ' minutes' : ''} ${time.seconds() > 0 ? time.seconds() + ' seconds' : ''}` : ''
    let msg1 = "Voice call completed! Your audio call session of " + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your Astrowize wallet."
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

    // send mail to consumer
    let consumerMsgbody = "Your audio call session of" + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your Astrowize wallet. Thank you for using our services."

    // sms
    let consumerSmsBody = "Your audio call session of" + durationMin + " with " + calldet.astrologer_id.first_name.charAt(0).toUpperCase() + calldet.astrologer_id.first_name.slice(1) + " has ended and ₹ " + client_call_rate + " has been deducted from your AstroWize wallet. Thank you for using our services, FINOTO."
    let template_id = "1707160828821117452"

    let smsData = {}
    smsData.to = ['91' + calldet.consumer_id.mobile.replace(/\D/g, '')]
    smsData.template_id = template_id
    smsData.message = "Hello " + calldet.consumer_id.first_name + ",\n" + consumerSmsBody
    // let sms = helper.sendSMS(smsData)

    // notify subscribed consumers about astrologer online

}

module.exports = {
    feeds,
}