var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/* Model */
const referralModel = require('../models/referral');
const userModel = require('../models/user');

/* NODE-MODULES */
var ObjectId = mongoose.Types.ObjectId;
var moment = require('moment-timezone');
const helper = require('../lib/helper');

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

var schema = new Schema({
    consumer_id: {
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    astrologer_id: {
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    chat_id: {
        type: Schema.Types.ObjectId,
        ref: 'chat'
    },
    call_id: {
        type: Schema.Types.ObjectId,
        ref: 'calldetail'
    },
    report_id: {
        type: Schema.Types.ObjectId,
        ref: 'report'
    },
    transaction_type: {
        type: String,
        enum: ['chat', 'report', 'audio', 'video', 'product', 'service', 'wallet', 'tip', 'deposit', 'settlement'] //deposit - online, wallet-wallet deposit or refund deposit
    },
    pay_type: {
        type: String,
        enum: ['first', 'second', 'refund']
    },
    service_req_id: {
        type: Schema.Types.ObjectId,
        ref: 'serviceRequest'
    },
    product_order_id: {
        type: Schema.Types.ObjectId,
        ref: 'productOrder'
    },
    settlement_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'settlement'
    },
    payment_status: {
        type: String,
        enum: ['pending', 'success', 'failed']
    },
    payment_type: String, //upi, credit, debit, wallet from payemnt gateway
    transaction_amt: Number,
    client_transaction_amt: Number,
    razor_fee: Number,
    razor_tax: Number,
    byAdmin: {
        type: Boolean,
        default: false
    }
},
    {
        timestamps: true
    });

const transaction = module.exports = mongoose.model('transaction', schema);

module.exports.getTransCount = async (req, cb) => {
    let data = await transaction.countDocuments({}).then(result => result)

    return data
}

module.exports.getTransByQuery = async (query, cb) => {
    let data = await transaction.findOne(query).then(result => result)

    return data
}

module.exports.saveTransaction = async (data, cb) => {
    console.log('saveTransaction data---', data)

    console.log('CHECK 1');

    let consTransData = await transaction.findOne({ $and: [{ consumer_id: data.consumer_id }, { transaction_type: { $ne: "wallet" } }, { transaction_type: { $ne: "tip" } }] })
        .then(result => result).catch(err => console.log('CHECK 1.1', err))

    console.log('CHECK 2');

    let astroTransData = await transaction.findOne({ $and: [{ astrologer_id: data.astrologer_id }, { transaction_type: { $ne: "tip" } }] })
        .then(result => result).catch(err => console.log('CHECK 2.1', err))

    console.log('CHECK 3');

    console.log('saveTransaction consTransData---', consTransData)
    console.log('saveTransaction astroTransData---', astroTransData)

    data.save(async (error, savedData) => {
        console.log('saveTransaction error---', error)

        if (error) {
            cb(error, undefined)
        }

        if (!consTransData && data.transaction_type != "wallet" && data.transaction_type != "tip") {
            let referData = await referralModel.getUserReferral({ user_id: data.consumer_id })
                .then(result => result)
            if (referData) {
                referData.first_transaction = savedData._id

                //sent message to referror
                var referMsg = "Astro & Wise! The astrologer you referred has been onboarded on AstroWize. Click here to view their profile."
                if (referData.referror_id.user_type == 'consumer') {
                    referMsg = "Da-Ding! " + referData.used_by_id.first_name + " referred by you has successfully made their first transaction as an AstroWize user."
                }
                let notifData = {
                    msg: referMsg,
                    title: "",
                    device_token: referData.referror_id.device_token,
                    data: {
                        message: referMsg,
                        flag: "First Transaction",
                    }
                }
                notifData.data.user_id = referData.referror_id._id
                notificationController.sendNotification(notifData)

                //send mail to referror
                var mailMsg = "Your referred consumer made their first transaction using AstroWize's services. We're glad to have you as a part of our family. "
                if (referData.referror_id.user_type == 'consumer') {
                    mailMsg = referData.used_by_id.first_name + " referred by you has successfully made their first transaction as an Astrowize user. Thank you for referring them."
                }
                let referMailData = {
                    email: referData.referror_id.email,
                    subject: 'AstroWize - First transaction made by referred consumer!',
                    body:
                        "<p>" +
                        "Hello " + referData.referror_id.first_name + "," +
                        "<p>" +
                        mailMsg +
                        "<p>" +
                        "Thank you for the reference!"
                };
                helper.sendEmail(referMailData)

                referData.save((error, refer) => {
                    console.log('saveTransaction refer err---', error, refer)
                })
            }
        }
        if (!astroTransData) {
            let referData = await referralModel.getUserReferral({ user_id: data.astrologer_id })
                .then(result => result)

            if (referData) {
                referData.first_transaction = savedData._id

                //sent message to referror
                let referMsg = "Your referred fellow astrologer made their first transaction on AstroWize. Congratulate them!"
                if (referData.referror_id.user_type == 'consumer') {
                    referMsg = referData.used_by_id.first_name + " has successfully made their first transaction as an Astrologer. Congratulate them!"
                }
                let notifData = {
                    msg: referMsg,
                    title: "",
                    device_token: referData.referror_id.device_token,
                    data: {
                        message: referMsg,
                        flag: "First Transaction",
                    }
                }
                notifData.data.user_id = referData.referror_id._id
                notificationController.sendNotification(notifData)

                //send mail to referror
                var mailMsg = "Your referred fellow astrologer " + referData.used_by_id.first_name + " made their first transaction on Astrowize today. Congratulate them!"
                if (referData.referror_id.user_type == 'consumer') {
                    mailMsg = referData.used_by_id.first_name + " has successfully made their first transaction as an Astrologer. Congratulate them now."
                }
                let referMailData = {
                    email: referData.referror_id.email,
                    subject: 'Your referred fellow astrologer made their first transaction',
                    body:
                        "<p>" +
                        "Hello " + referData.referror_id.first_name + "," +
                        "<p>" +
                        mailMsg +
                        "Regards," +
                        "<br>" +
                        "Team AstroWize"
                };
                helper.sendEmail(referMailData)

                referData.save((error, refer) => {
                    console.log('saveTransaction refer err---', error, refer)
                })
            }
        }

        cb(null, savedData)
    })
}

module.exports.getSummaryCount = async (req, cb) => {

    console.log('getSummaryCount req.body ', req.body);
    console.log('getSummaryCount req.user ', req.user);

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    var groupBy = {
        year: "$year",
        month: "$month"
    }
    var monthMatchQuery = { $match: { month: month, year: year } }
    var matchQuery = { $match: {} }
    var orderMatchQuery = { $match: {} }

    if (req.user._id && req.user._id != "" && req.user.user_type == "consumer") {
        console.log('getSummaryCount consumer ');
        monthMatchQuery = { $match: {} }
        matchQuery = { $match: { "consumer_id": ObjectId(req.user._id) } }
        orderMatchQuery = { $match: { "consumer_id": ObjectId(req.user._id), order_status: { $gt: [] } } }
        groupBy = {
            consumer_id: "$consumer_id"
        }
    }
    else if (req.user._id && req.user._id != "" && req.user.user_type == "astrologer") {
        monthMatchQuery = { $match: {} }
        matchQuery = { $match: { "astrologer_id": ObjectId(req.user._id) } }
        orderMatchQuery = { $match: { "astrologer_id": ObjectId(req.user._id), order_status: { $gt: [] } } }
        groupBy = {
            astrologer_id: "$astrologer_id"
        }
    }
    else if (req.body.astrologer_id && req.body.astrologer_id != "") {
        if (req.body.api_name == 'getReportList') {
            monthMatchQuery = { $match: {} }
            matchQuery = { $match: { "astrologer_id": ObjectId(req.body.astrologer_id) } }
            groupBy = {
                astrologer_id: "$astrologer_id"
            }
            orderMatchQuery = { $match: { "astrologer_id": ObjectId(req.body.astrologer_id), order_status: { $gt: [] } } }
        }
        else {
            monthMatchQuery = { $match: {} }
            matchQuery = { $match: { "astrologer_id": ObjectId(req.body.astrologer_id) } }
            groupBy = {
                astrologer_id: "$astrologer_id"
            }
            orderMatchQuery = { $match: { "astrologer_id": ObjectId(req.body.astrologer_id), order_status: { $gt: [] } } }
        }
    }
    else if (req.body.consumer_id && req.body.consumer_id != "") {
        monthMatchQuery = { $match: {} }
        matchQuery = { $match: { "consumer_id": ObjectId(req.body.consumer_id) } }
        groupBy = {
            consumer_id: "$consumer_id"
        }
        orderMatchQuery = { $match: { "consumer_id": ObjectId(req.body.consumer_id), order_status: { $gt: [] } } }
    }


    let data = await userModel.aggregate( // 1. Use any collection containing at least one document.
        [
            { $limit: 1 }, // 2. Keep only one document of the collection.
            { $project: { _id: '$$REMOVE' } }, // 3. Remove everything from the document.

            // 4. Lookup collections to union together.
            { $lookup: { from: 'calldetails', pipeline: [matchQuery, { $match: { call_audio_video: "audio", room_status: { $ne: 'no_status' } } }, { $addFields: { collection_type: "audio" } }], as: 'audio' } },
            { $lookup: { from: 'calldetails', pipeline: [matchQuery, { $match: { call_audio_video: "video" } }, { $addFields: { collection_type: "video" } }], as: 'video' } },
            { $lookup: { from: 'servicerequests', pipeline: [matchQuery, { $addFields: { collection_type: "service" } }], as: 'services' } },
            { $lookup: { from: 'chats', pipeline: [matchQuery, { $addFields: { collection_type: "chat" } }], as: 'chats' } },
            { $lookup: { from: 'reports', pipeline: [matchQuery, { $addFields: { collection_type: "report" } }], as: 'reports' } },
            // Using the additional "consumer_id" saved in productOrders for the purpose of matchQuery and groupBy
            { $lookup: { from: 'productorders', pipeline: [orderMatchQuery, { $addFields: { collection_type: "order" } }], as: 'productorders' } },

            // 5. Union the collections together with a projection.
            {
                $project:
                {
                    union: { $concatArrays: ["$audio", "$video", "$services", "$chats", "$reports", "$productorders"] }
                }
            },
            // 6. Unwind and replace root so you end up with a result set.
            { $unwind: '$union' },
            { $replaceRoot: { newRoot: '$union' } },
            {
                $addFields: {
                    year: {
                        $year: "$updatedAt"
                    },
                    month: {
                        $month: "$updatedAt"
                    }
                }
            },
            monthMatchQuery,
            {
                $group: {
                    _id: groupBy,
                    "chatCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "chat"] }, 1, 0] }
                    },
                    "chatAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "chat"] }, "$chat_rate", 0] }
                    },
                    "audioCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "audio"] }, 1, 0] }
                    },
                    "audioAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "audio"] }, "$call_rate", 0] }
                    },
                    "reportCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "report"] }, 1, 0] }
                    },
                    "reportAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "report"] }, "$report_rate", 0] }
                    },
                    "aciveReportCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "report"] }, { "$or": [{ "$eq": ["$report_status", "Ordered"] }, { "$eq": ["$report_status", "Rejected"] }, { "$eq": ["$report_status", "Uploaded"] }] }] }, 1, 0] }
                    },
                    "activeReportAmount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "report"] }, { "$or": [{ "$eq": ["$report_status", "Ordered"] }, { "$eq": ["$report_status", "Rejected"] }, { "$eq": ["$report_status", "Uploaded"] }] }] }, "$report_rate", 0] }
                    },
                    "videoCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "video"] }, 1, 0] }
                    },
                    "videoAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "video"] }, "$call_rate", 0] }
                    },
                    "approvedRequestCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "service"] }, { "$eq": ["$service_status", "Completed"] }] }, 1, 0] }
                    },
                    "otherRequestCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "service"] }, { "$or": [{ "$eq": ["$service_status", "New"] }, { "$eq": ["$service_status", "Approved"] }, { "$eq": ["$service_status", "Scheduled"] }, { "$eq": ["$service_status", "Started"] }] }] }, 1, 0] }
                    },
                    "requestCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "service"] }, 1, 0] }
                    },
                    "requestAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "service"] }, "$rate", 0] }
                    },
                    "orderCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "order"] }, { "$ne": ["$current_status", "pending"] }] }, 1, 0] }
                    },
                    "newOrderCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "order"] }, { "$eq": ["$current_status", "New"] },] }, 1, 0] }
                    },
                }
            },
            {
                $project:
                {
                    _id: 1,
                    transactions: 1,
                    chatCount: { $round: ['$chatCount', 0] },
                    chatAmount: { $round: ['$chatAmount', 2] },
                    audioCount: { $round: ['$audioCount', 0] },
                    audioAmount: { $round: ["$audioAmount", 2] },
                    reportCount: { $round: ['$reportCount', 0] },
                    reportAmount: { $round: ["$reportAmount", 2] },
                    aciveReportCount: { $round: ['$aciveReportCount', 0] },
                    activeReportAmount: { $round: ["$activeReportAmount", 2] },
                    videoCount: { $round: ['$videoCount', 0] },
                    videoAmount: { $round: ["$videoAmount", 2] },
                    approvedRequestCount: { $round: ["$approvedRequestCount", 0] },
                    otherRequestCount: { $round: ["$otherRequestCount", 0] },
                    requestCount: { $round: ["$requestCount", 0] },
                    requestAmount: { $round: ["$requestAmount", 2] },
                    orderCount: { $round: ["$orderCount", 0] },
                    newOrderCount: { $round: ["$newOrderCount", 0] },
                    total_count: { $sum: ["$chatCount", "$audioCount", "$reportCount", "$videoCount", "$requestCount"] },
                    total_amount: { $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount"] }
                }
            }
        ]);

    console.log('getSummaryCount data ', data);

    return data
}

module.exports.getConsulationsCount = async (req, cb) => {
    console.log('getConsulationsCount req.body ', req.body);
    console.log('getConsulationsCount req.user ', req.user);

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    var groupBy = {
        year: "$year",
        month: "$month"
    }
    var monthMatchQuery = { $match: { month: month, year: year } }
    var matchQuery = { $match: {} }

    if (req.user._id && req.user._id != "" && req.user.user_type == "consumer") {
        console.log('getConsulationsCount consumer ');

        monthMatchQuery = { $match: {} }
        matchQuery = { $match: { "consumer_id": ObjectId(req.user._id) } }
        groupBy = {
            consumer_id: "$consumer_id"
        }
    }
    else if (req.user._id && req.user._id != "" && req.user.user_type == "astrologer") {
        monthMatchQuery = { $match: {} }
        matchQuery = { $match: { "astrologer_id": ObjectId(req.user._id) } }
        groupBy = {
            astrologer_id: "$astrologer_id"
        }
    }
    else if (req.body.astrologer_id && req.body.astrologer_id != "") {
        if (req.body.api_name == 'getReportList') {
            monthMatchQuery = { $match: {} }
            matchQuery = { $match: { "astrologer_id": ObjectId(req.body.astrologer_id) } }
            groupBy = {
                astrologer_id: "$astrologer_id"
            }
        }
        else {
            monthMatchQuery = { $match: {} }
            matchQuery = { $match: { "astrologer_id": ObjectId(req.body.astrologer_id) } }
            groupBy = {
                astrologer_id: "$astrologer_id"
            }
        }
    }
    else if (req.body.consumer_id && req.body.consumer_id != "") {
        monthMatchQuery = { $match: {} }
        matchQuery = { $match: { "consumer_id": ObjectId(req.body.consumer_id) } }
        groupBy = {
            consumer_id: "$consumer_id"
        }
    }

    let data = await transaction.aggregate([
        matchQuery,
        {
            $project: {
                year: {
                    $year: "$updatedAt"
                },
                month: {
                    $month: "$updatedAt"
                },
                transaction_amt: 1,
                updatedAt: 1,
                astrologer_id: 1,
                chat_id: 1,
                report_id: 1,
                service_req_id: 1,
                transaction_type: 1
            }
        },
        monthMatchQuery,
        {
            '$lookup':
            {
                localField: "report_id",
                foreignField: "_id",
                from: "reports",
                as: "report_id"
            }
        },
        { $unwind: { path: "$report_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "service_req_id",

            }
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: groupBy,
                "chatCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, 1, 0] }
                },
                "chatAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$transaction_amt", 0] }
                },
                "audioCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, 1, 0] }
                },
                "audioAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$transaction_amt", 0] }
                },
                "reportCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, 1, 0] }
                },
                "reportAmount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, "$transaction_amt", 0] }
                },
                "videoCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, 1, 0] }
                },
                "videoAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$transaction_amt", 0] }
                },
                "approvedRequestCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, 1, 0] }
                },
                "otherRequestCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$ne": ["$service_req_id.service_status", "Completed"] }] }, 1, 0] }
                },
                "requestCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "service"] }, 1, 0] }
                },
                "requestCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, 1, 0] }
                },
                "requestAmount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, "$transaction_amt", 0] }
                },
            }
        },
        {
            $project:
            {
                _id: 1,
                transactions: 1,
                chatCount: { $round: ['$chatCount', 0] },
                chatAmount: { $round: ['$chatAmount', 2] },
                audioCount: { $round: ['$audioCount', 0] },
                audioAmount: { $round: ["$audioAmount", 2] },
                reportCount: { $round: ['$reportCount', 0] },
                reportAmount: { $round: ["$reportAmount", 2] },
                videoCount: { $round: ['$videoCount', 0] },
                videoAmount: { $round: ["$videoAmount", 2] },
                approvedRequestCount: { $round: ["$approvedRequestCount", 0] },
                otherRequestCount: { $round: ["$otherRequestCount", 0] },
                requestCount: { $round: ["$requestCount", 0] },
                requestAmount: { $round: ["$requestAmount", 2] },
                total_count: { $sum: ["$chatCount", "$audioCount", "$reportCount", "$videoCount", "$requestCount"] },
                total_amount: { $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount"] }
            }
        }
    ])

    console.log('getConsulationsCount data month', month, '--- ', data);

    return data
}

module.exports.getWalletTransactions = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    var matchQuery = { $match: { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] } }
    if (req.user.user_type == 'consumer') {
        matchQuery = { $match: { $and: [{ consumer_id: ObjectId(req.user._id) }, { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] }] } }
    }
    if (req.user.user_type == 'astrologer') {
        matchQuery = { $match: { $and: [{ astrologer_id: ObjectId(req.user._id) }, { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] }] } }
    }

    let data = await transaction.aggregate([
        matchQuery,
        { $match: { payment_status: "success" } },
        {
            $lookup: {
                from: "ratings",
                localField: "rating_id",
                foreignField: "_id",
                as: "rating_id"
            }
        },
        {
            $unwind: { path: "$rating_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "consumer_id",
                foreignField: "_id",
                as: "consumer_id"
            }
        },
        {
            $unwind: { path: "$consumer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "astrologer_id",
                foreignField: "_id",
                as: "astrologer_id"
            }
        },
        {
            $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "chats",
                localField: "chat_id",
                foreignField: "_id",
                as: "chat_id"
            }
        },
        {
            $unwind: { path: "$chat_id", preserveNullAndEmptyArrays: true }
        },
        {
            '$lookup':
            {
                localField: "call_id",
                foreignField: "_id",
                from: "calldetails",
                as: "call_id"
            }
        },
        { $unwind: { path: "$call_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "report_id",
                foreignField: "_id",
                from: "reports",
                as: "report_id"
            }
        },
        { $unwind: { path: "$report_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "service_req_id",

            }
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id.service_id",
                foreignField: "_id",
                from: "services",
                as: "service_req_id.service_id",

            }
        },
        { $unwind: { path: "$service_req_id.service_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "product_order_id",
                foreignField: "_id",
                from: "productorders",
                as: "product_order_id"
            }
        },
        { $unwind: { path: "$product_order_id", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$product_order_id.products", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "product_order_id.products.product_id",
                foreignField: "_id",
                from: "products",
                as: "product_order_id.products.product_id"
            }
        },
        { $unwind: { path: "$product_order_id.products.product_id", preserveNullAndEmptyArrays: true } },
        {
            "$group":
            {
                _id: "$_id",
                "products": { "$push": "$product_order_id.products" },
                data: { $first: "$$ROOT" }
            }
        },
        {
            $project: {
                "_id": 1,
                "product_order_id": { "$cond": [{ "$eq": ["$data.transaction_type", "product"] }, "$data.product_order_id", null] },
                "products": { "$cond": [{ "$eq": ["$data.transaction_type", "product"] }, "$products", null] },
                "transaction_type": "$data.transaction_type",
                "transaction_amt": "$data.transaction_amt",
                "client_transaction_amt": "$data.client_transaction_amt",
                "consumer_id": "$data.consumer_id",
                "astrologer_id": "$data.astrologer_id",
                "payment_status": "$data.payment_status",
                "createdAt": "$data.createdAt",
                "updatedAt": "$data.updatedAt",
                "year": "$data.year",
                "month": "$data.month",
                "call_id": "$data.call_id",
                "chat_id": "$data.chat_id",
                "report_id": "$data.report_id",
                "service_req_id": "$data.service_req_id",
                "payment_type": "$data.payment_type",
                "rating_id": "$data.rating_id"
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $facet: {
                data: [{ $skip: skipPage }, { $limit: perPage }],
                totalCount: [
                    {
                        $count: 'count'
                    }
                ]
            }
        },
        { $unwind: "$totalCount" },
        {
            $project: {
                data: 1,
                totalCount: "$totalCount.count"
            }
        }
    ])

    return data
}

module.exports.getTransactions = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    console.log('getTransactions month ', month, year);

    var matchQuery = { $match: { $or: [{ payment_status: "success" }, { payment_status: "success" }] } } //{ payment_status: "failed" }
    if (req.user.user_type == 'consumer') {
        matchQuery = { $match: { $and: [{ consumer_id: ObjectId(req.user._id) }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
    }
    else if (req.user.user_type == 'astrologer') {
        matchQuery = { $match: { $and: [{ astrologer_id: ObjectId(req.user._id) }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
    }
    if (req.user.user_type == 'admin') {
        matchQuery = {
            $match: {
                $and: [
                    {
                        $or: [
                            { payment_status: "success" },
                            { payment_status: "success" }
                        ]
                    },
                    { $expr: { $ne: ["$transaction_type", "wallet"] } },
                    { $expr: { $ne: ["$transaction_type", "deposit"] } }
                ]
            }
        }
    }

    if (req.body.filter_type == "wallet") {
        matchQuery = { $match: { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] } }
        if (req.user.user_type == 'consumer') {
            matchQuery = { $match: { $and: [{ consumer_id: ObjectId(req.user._id) }, { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
        }
        if (req.user.user_type == 'astrologer') {
            matchQuery = { $match: { $and: [{ astrologer_id: ObjectId(req.user._id) }, { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
        }
    }

    let matchQuery1 = {}
    if(req.body.type && req.body.type != ''){
        matchQuery1 = { ...matchQuery1, 'transaction_type': { $eq: req.body.type } }
    }

    if(req.body.astrologerId && req.body.astrologerId != ''){
        matchQuery1 = { ...matchQuery1, 'astrologer_id': ObjectId(req.body.astrologerId) }
    }
    
    let searchQuery = {}
    if(req.body.searchText && req.body.searchText != ''){
        searchQuery = { ...searchQuery, $or: [ { 'consumer_id.mobile': { $regex: req.body.searchText, $options: 'i' } }, {'consumer_id.first_name': { $regex: req.body.searchText, $options: 'i' } }  ] }
    }

    let data = await transaction.aggregate([
        matchQuery,
        {
            $match: matchQuery1
        },
        {
            $addFields: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
            }
        },
        {
            $match: {
                year: year,
                month: month
            }
        },
        {
            $lookup: {
                from: "settlements",
                localField: "settlement_id",
                foreignField: "_id",
                as: "settlement_id"
            }
        },
        {
            $unwind: { path: "$settlement_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "consumer_id",
                foreignField: "_id",
                as: "consumer_id"
            }
        },
        {
            $unwind: { path: "$consumer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $match: searchQuery
        },
        {
            $lookup: {
                from: "ratings",
                localField: "rating_id",
                foreignField: "_id",
                as: "rating_id"
            }
        },
        {
            $unwind: { path: "$rating_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "astrologer_id",
                foreignField: "_id",
                as: "astrologer_id"
            }
        },
        {
            $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "chats",
                localField: "chat_id",
                foreignField: "_id",
                as: "chat_id"
            }
        },
        {
            $unwind: { path: "$chat_id", preserveNullAndEmptyArrays: true }
        },
        {
            '$lookup':
            {
                localField: "call_id",
                foreignField: "_id",
                from: "calldetails",
                as: "call_id"
            }
        },
        { $unwind: { path: "$call_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "report_id",
                foreignField: "_id",
                from: "reports",
                as: "report_id"
            }
        },
        { $unwind: { path: "$report_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "service_req_id",

            }
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id.service_id",
                foreignField: "_id",
                from: "services",
                as: "service_req_id.service_id",

            }
        },
        { $unwind: { path: "$service_req_id.service_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "product_order_id",
                foreignField: "_id",
                from: "productorders",
                as: "product_order_id"
            }
        },
        { $unwind: { path: "$product_order_id", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$product_order_id.products", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "product_order_id.products.product_id",
                foreignField: "_id",
                from: "products",
                as: "product_order_id.products.product_id"
            }
        },
        { $unwind: { path: "$product_order_id.products.product_id", preserveNullAndEmptyArrays: true } },
        {
            "$group":
            {
                _id: "$_id",
                "products": { "$push": "$product_order_id.products" },
                data: { $first: "$$ROOT" }
            }
        },
        {
            $project: {
                "_id": 1,
                "product_order_id": { "$cond": [{ "$eq": ["$data.transaction_type", "product"] }, "$data.product_order_id", null] },
                "products": { "$cond": [{ "$eq": ["$data.transaction_type", "product"] }, "$products", null] },
                "transaction_type": "$data.transaction_type",
                "payment_type": "$data.payment_type",
                "pay_type": "$data.pay_type",
                "transaction_amt": "$data.transaction_amt",
                "client_transaction_amt": "$data.client_transaction_amt",
                "consumer_id": "$data.consumer_id",
                "astrologer_id": "$data.astrologer_id",
                "payment_status": "$data.payment_status",
                "createdAt": "$data.createdAt",
                "updatedAt": "$data.updatedAt",
                "year": "$data.year",
                "month": "$data.month",
                "call_id": "$data.call_id",
                "chat_id": "$data.chat_id",
                "report_id": "$data.report_id",
                "service_req_id": "$data.service_req_id",
                "rating_id": "$data.rating_id",
                "settlement_id": "$data.settlement_id",
                "byAdmin": "$data.byAdmin",
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $facet: {
                data: [{ $skip: skipPage }, { $limit: perPage }],
                totalCount: [
                    {
                        $count: 'count'
                    }
                ]
            }
        },
        { $unwind: "$totalCount" },
        {
            $project: {
                data: 1,
                totalCount: "$totalCount.count"
            }
        }
    ])

    return data
}

module.exports.getConsulationsData = async (req, cb) => {
    //month and year
    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    console.log('getConsulationsData month ', month, year);

    var groupBy = {
        year: "$year",
        month: "$month",
        weekOfMonth: "$weekOfMonth"
    }
    var matchQuery = { $match: {} }

    if (req.body.astrologer_id && req.body.astrologer_id != "") {
        matchQuery = { $match: { "astrologer_id": ObjectId(req.body.astrologer_id) } }
        groupBy = {
            year: "$year",
            month: "$month",
            weekOfMonth: "$weekOfMonth",
            astrologer_id: "$astrologer_id"
        }
    }

    let data = await transaction.aggregate([
        matchQuery,
        {
            $project: {
                year: {
                    $year: "$updatedAt"
                },
                month: {
                    $month: "$updatedAt"
                },
                week: {
                    $week: "$updatedAt"
                },
                day: {
                    $dayOfWeek: "$updatedAt"
                },
                "weekOfMonth": { $floor: { $divide: [{ $dayOfMonth: "$updatedAt" }, 7] } },
                transaction_amt: 1,
                updatedAt: 1,
                astrologer_id: 1,
                chat_id: 1,
                transaction_type: 1,
                "report_id": 1,
                "service_req_id": 1,
            }
        },
        { $match: { month: month, year: year } },
        {
            $unwind: { path: "$astrologer_id" }
        },
        {
            '$lookup':
            {
                localField: "report_id",
                foreignField: "_id",
                from: "reports",
                as: "report_id"
            }
        },
        { $unwind: { path: "$report_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "service_req_id",

            }
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: groupBy,
                "chatCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, 1, 0] }
                },
                "chatAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$transaction_amt", 0] }
                },
                "audioCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, 1, 0] }
                },
                "audioAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$transaction_amt", 0] }
                },
                "reportCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, 1, 0] }
                },
                "reportAmount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, "$transaction_amt", 0] }
                },
                "videoCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, 1, 0] }
                },
                "videoAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$transaction_amt", 0] }
                },
                "requestCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, 1, 0] }
                },
                "requestAmount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, "$transaction_amt", 0] }
                },
                transactions: {
                    $push: {
                        _id: "$_id",
                        transaction_amt: "$transaction_amt",
                        "updatedAt": "$updatedAt",
                        "astrologer_id": "$astrologer_id",
                        "chat_id": "$chat_id",
                        "report_id": "$report_id",
                        "service_req_id": "$service_req_id",
                        "transaction_type": "$transaction_type",
                    }
                }
            }
        },
        {
            $project:
            {
                _id: 0,
                transactions: 1,
                chatCount: { $round: ['$chatCount', 0] },
                chatAmount: { $round: ['$chatAmount', 2] },
                audioCount: { $round: ['$audioCount', 0] },
                audioAmount: { $round: ["$audioAmount", 2] },
                reportCount: { $round: ['$reportCount', 0] },
                reportAmount: { $round: ["$reportAmount", 2] },
                videoCount: { $round: ['$videoCount', 0] },
                videoAmount: { $round: ["$videoAmount", 2] },
                requestCount: { $round: ["$requestCount", 0] },
                requestAmount: { $round: ["$requestAmount", 2] },
                weekOfMonth: "$_id.weekOfMonth",
                year: "$_id.year",
                month: "$_id.month",
                name: "$_id.weekOfMonth",
                total_count: { $round: [{ $sum: ["$chatCount", "$audioCount", "$reportCount", "$videoCount", "$requestCount"] }, 2] },
                total_amount: { $round: [{ $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount"] }, 2] }
            }
        },
        { "$sort": { "weekOfMonth": -1 } },
    ])

    console.log('getConsulationsData data --- ', data);

    return data
}

module.exports.getTopServices = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 2
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await transaction.aggregate([
        { $match: { "transaction_type": "service" } },
        {
            $lookup: {
                from: 'servicerequests',
                localField: 'service_req_id',
                foreignField: '_id',
                as: 'service_req_id'
            }
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'services',
                localField: 'service_req_id.service_id',
                foreignField: '_id',
                as: 'service_req_id.service_id'
            }
        },
        { $unwind: { path: "$service_req_id.service_id", preserveNullAndEmptyArrays: true } },
        { $match: { $or: [{ "service_req_id.service_status": "Approved" }, { "service_req_id.service_status": "Scheduled" }, { "service_req_id.service_status": "Completed" }] } },
        {
            "$group":
            {
                _id: "$service_req_id.service_id._id",
                total_count: { $sum: 1 },
                total_amount: { $sum: "$transaction_amt" },
                "client_total_amount": { $sum: "$client_transaction_amt" },
                data: { $first: "$$ROOT" }
            }
        },
        {
            $project: {
                "_id": "$data._id",
                total_count: "$total_count",
                total_amount: { $round: ["$total_amount", 2] },
                client_total_amount: { $round: ["$client_total_amount", 2] },
                service_req_id: "$data.service_req_id._id",
                createdAt: "$data.service_req_id.createdAt",
                updatedAt: "$data.service_req_id.updatedAt",
                payment_status: "$data.payment_status",
                service_id: "$data.service_req_id.service_id._id",
                name: "$data.service_req_id.service_id.name",
                description: "$data.service_req_id.service_id.description",
                image_url: "$data.service_req_id.service_id.image_url"
            }
        },
        { "$sort": { "total_count": -1 } },
        { $skip: skipPage },
        { $limit: perPage }
    ])

    return data
}

module.exports.getTopProducts = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 2
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await transaction.aggregate([
        { $match: { "transaction_type": "product" } },
        {
            $lookup: {
                from: 'productorders',
                localField: 'product_order_id',
                foreignField: '_id',
                as: 'product_order_id'
            }
        },
        { $unwind: { path: "$product_order_id", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$product_order_id.products", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'products',
                localField: 'product_order_id.products.product_id',
                foreignField: '_id',
                as: 'product_order_id.products.product_id'
            }
        },
        { $unwind: { path: "$product_order_id.products.product_id", preserveNullAndEmptyArrays: true } },
        {
            $project:
            {
                _id: 1,
                "product_order_id": 1,
                "transaction_type": 1,
                "consumer_id": 1,
                "payment_status": 1,
                "createdAt": 1,
                "updatedAt": 1,
                "transaction_amt": 1,
                product_total: { $multiply: ["$product_order_id.products.quantity", "$product_order_id.products.rate"] },

            }
        },
        {
            "$group":
            {
                _id: "$product_order_id.products.product_id",
                total_count: { $sum: "$product_order_id.products.quantity" },
                total_amount: { $sum: "$product_total" },
                data: { $first: "$$ROOT" }
            }
        },
        {
            $project: {
                "_id": "$data._id",
                total_count: "$total_count",
                total_amount: { $round: ["$total_amount", 2] },
                product_order_id: "$data.product_order_id._id",
                createdAt: "$data.product_order_id.createdAt",
                updatedAt: "$data.product_order_id.updatedAt",
                payment_status: "$data.payment_status",
                product_id: "$data.product_order_id.products.product_id._id",
                name: "$data.product_order_id.products.product_id.name",
                description: "$data.product_order_id.products.product_id.description",
                image_url: "$data.product_order_id.products.product_id.image_url",
                commision: { $round: [{ $subtract: ["$client_total_amount", "$total_amount"] }, 2] }
            }
        },
        { "$sort": { "total_count": -1 } },
        { $skip: skipPage },
        { $limit: perPage }
    ])

    return data
}

module.exports.getTopAstrolgers = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 2
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await transaction.aggregate([
        { $match: { "payment_status": "success" } },
        { $match: { $or: [{ "transaction_type": "chat" }, { "transaction_type": "audio" }, { "transaction_type": "video" }, { "transaction_type": "report" }] } },
        {
            $lookup: {
                from: 'users',
                localField: 'astrologer_id',
                foreignField: '_id',
                as: 'astrologer_id'
            }
        },
        { $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: "$astrologer_id._id",
                "chatCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, 1, 0] }
                },
                "chatAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$transaction_amt", 0] }
                },
                "clientChatAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$client_transaction_amt", 0] }
                },
                "audioCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, 1, 0] }
                },
                "audioAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$transaction_amt", 0] }
                },
                "clientAudioAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$client_transaction_amt", 0] }
                },
                "reportCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "report"] }, 1, 0] }
                },
                "reportAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "report"] }, "$transaction_amt", 0] }
                },
                "clientReportAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "report"] }, "$client_transaction_amt", 0] }
                },
                "videoCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, 1, 0] }
                },
                "videoAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$transaction_amt", 0] }
                },
                "clientVideoAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$client_transaction_amt", 0] }
                },
                // "total_amount": { $sum: "$transaction_amt" },
                // "client_total_amount": { $sum: "$client_transaction_amt" },
                "total_amount": {
                    "$sum": { "$cond": [{ "$ne": ["$transaction_type", "settlement"] }, "$transaction_amt", 0] }
                },
                "client_total_amount": {
                    "$sum": { "$cond": [{ "$ne": ["$transaction_type", "settlement"] }, "$client_transaction_amt", 0] }
                },
                data: { $first: "$$ROOT" }
            }
        },
        {
            $project:
            {
                _id: 1,
                transactions: 1,
                chatCount: { $round: ['$chatCount', 0] },
                chatAmount: { $round: ['$chatAmount', 2] },
                clientChatAmount: { $round: ['$clientChatAmount', 2] },
                audioCount: { $round: ['$audioCount', 0] },
                audioAmount: { $round: ["$audioAmount", 2] },
                clientAudioAmount: { $round: ["$clientAudioAmount", 2] },
                reportCount: { $round: ['$reportCount', 0] },
                reportAmount: { $round: ["$reportAmount", 2] },
                clientReportAmount: { $round: ["$clientReportAmount", 2] },
                videoCount: { $round: ['$videoCount', 0] },
                videoAmount: { $round: ["$videoAmount", 2] },
                clientVideoAmount: { $round: ["$clientVideoAmount", 2] },
                total_amount: { $round: ["$total_amount", 2] },
                client_total_amount: { $round: ["$client_total_amount", 2] },
                "astrologer_id._id": "$data.astrologer_id._id",
                "astrologer_id.first_name": "$data.astrologer_id.first_name",
                "astrologer_id.email": "$data.astrologer_id.email",
                "astrologer_id.profile_url": "$data.astrologer_id.profile_url",
                commision: { $round: [{ $subtract: ["$client_total_amount", "$total_amount"] }, 2] }
            }
        },
        { "$sort": { "total_amount": -1 } },
        { $skip: skipPage },
        { $limit: perPage }
    ])

    return data
}

module.exports.getEarnings = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    console.log('getEarning req.body', req.body);

    let date = new Date();
    var currentMonth = (req.body.month !== '' && req.body.month !== undefined) ? parseInt(req.body.month) + 1 : date.getMonth() + 1
    var currentYear = req.body.year ? parseInt(req.body.year) : date.getFullYear()

    date.setMonth(date.getMonth() - 1);
    var prevMonth = date.getMonth() + 1
    var prevYear = date.getFullYear()

    console.log('getEarning date outside', date);

    // if (req.body.month != undefined && req.body.month != '' && req.body.year != undefined && req.body.year != '') {
    //     date = new Date()
    //     date.setMonth(parseInt(req.body.month));

    //     console.log('getEarning date inside', date);

    //     currentMonth = date.getMonth() + 1
    //     currentYear = parseInt(req.body.year)

    //     date.setMonth(date.getMonth() - 1);
    //     prevMonth = date.getMonth() + 1
    //     prevYear = date.getFullYear()
    // }

    var user_id = req.body.user_id ? req.body.user_id : req.user._id

    let data = await transaction.aggregate([
        { $match: { "astrologer_id": ObjectId(user_id) } },
        {
            $addFields: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
            }
        },
        {
            $lookup: {
                from: "settlements",
                localField: "settlement_id",
                foreignField: "_id",
                as: "settlement_id"
            }
        },
        {
            $unwind: { path: "$settlement_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "consumer_id",
                foreignField: "_id",
                as: "consumer_id"
            }
        },
        {
            $unwind: { path: "$consumer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: 'astrosigns',
                localField: 'consumer_id.astro_sign',
                foreignField: '_id',
                as: 'consumer_id.astro_sign'
            }
        },
        {
            $unwind: { path: "$consumer_id.astro_sign", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "astrologer_id",
                foreignField: "_id",
                as: "astrologer_id"
            }
        },
        {
            $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "ratings",
                localField: "rating_id",
                foreignField: "_id",
                as: "rating_id"
            }
        },
        {
            $unwind: { path: "$rating_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "chats",
                localField: "chat_id",
                foreignField: "_id",
                as: "chat_id"
            }
        },
        {
            $unwind: { path: "$chat_id", preserveNullAndEmptyArrays: true }
        },
        {
            '$lookup':
            {
                localField: "call_id",
                foreignField: "_id",
                from: "calldetails",
                as: "call_id"
            }
        },
        { $unwind: { path: "$call_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "report_id",
                foreignField: "_id",
                from: "reports",
                as: "report_id"
            }
        },
        { $unwind: { path: "$report_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "service_req_id",

            }
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "service_req_id.service_id",
                foreignField: "_id",
                from: "services",
                as: "service_req_id.service_id",

            }
        },
        { $unwind: { path: "$service_req_id.service_id", preserveNullAndEmptyArrays: true } },
        {
            $facet: {
                last_settlement: [
                    { $match: { $expr: { $ne: ["$transaction_type", "settlement"] } } },
                    { '$sort': { "settlement_id.createdAt": -1 } },
                    { $skip: 0 }, { $limit: 1 }
                ],
                current_month: [
                    { $match: { month: currentMonth, year: currentYear } },
                    {
                        $group:
                        {
                            _id: {
                                year: "$year",
                                month: "$month"
                            },
                            "chatAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$transaction_amt", 0] }
                            },
                            "audioAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$transaction_amt", 0] }
                            },
                            "reportAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, "$transaction_amt", 0] }
                            },
                            "videoAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$transaction_amt", 0] }
                            },
                            "requestAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, "$transaction_amt", 0] }
                            },
                            "tipAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "tip"] }, { "$eq": ["$payment_status", "success"] }] }, "$transaction_amt", 0] }
                            },
                        }
                    },
                    {
                        $project:
                        {
                            _id: 0,
                            total_amount: { $round: [{ $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount", "$tipAmount"] }, 2] }
                        }
                    }
                ],
                previous_month: [
                    { $match: { month: prevMonth, year: prevYear } },
                    {
                        $group:
                        {
                            _id: {
                                year: "$year",
                                month: "$month"
                            },
                            "chatAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$transaction_amt", 0] }
                            },
                            "audioAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$transaction_amt", 0] }
                            },
                            "reportAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, "$transaction_amt", 0] }
                            },
                            "videoAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$transaction_amt", 0] }
                            },
                            "requestAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, "$transaction_amt", 0] }
                            },
                            "tipAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "tip"] }, { "$eq": ["$payment_status", "success"] }] }, "$transaction_amt", 0] }
                            },
                        }
                    },
                    {
                        $project:
                        {
                            _id: 0,
                            total_amount: { $round: [{ $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount", "$tipAmount"] }, 2] }
                        }
                    }
                ],
                settled_data: [
                    {
                        $group:
                        {
                            _id: "$astrologer_id",
                            "chatAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$transaction_amt", 0] }
                            },
                            "audioAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$transaction_amt", 0] }
                            },
                            "reportAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, "$transaction_amt", 0] }
                            },
                            "videoAmount": {
                                "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$transaction_amt", 0] }
                            },
                            "requestAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Completed"] }] }, "$transaction_amt", 0] }
                            },
                            "tipAmount": {
                                "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "tip"] }, { "$eq": ["$payment_status", "success"] }] }, "$transaction_amt", 0] }
                            },
                            settled_amount: {
                                "$sum": {
                                    "$cond": [
                                        { "$and": [{ "$ifNull": ["$settlement_id", false] }, { "$ne": ["$transaction_type", "settlement"] }] },
                                        "$transaction_amt",
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    {
                        $project:
                        {
                            _id: 0,
                            total_amount: { $round: [{ $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount", "$tipAmount"] }, 2] },
                            settled_amount: { $round: ['$settled_amount', 2] },
                        }
                    }
                ],
                all_data: [
                    { $match: { month: currentMonth, year: currentYear } },
                    {
                        $match: {
                            "$or": [
                                { "transaction_type": "chat" },
                                { "transaction_type": "settlement" },
                                { "transaction_type": "audio" },
                                { "transaction_type": "video" },
                                { "$and": [{ "transaction_type": "report" }, { "report_id.report_status": "Approved" }] },
                                { "$and": [{ "transaction_type": "service" }, { "service_req_id.service_status": "Completed" }] },
                                { "$and": [{ "transaction_type": "tip" }, { "payment_status": "success" }] }
                            ]
                        }
                    },
                    {
                        $group: {
                            _id: {
                                "_id": {
                                    "service_req_id": "$service_req_id",
                                    "product_order_id": "$product_order_id",
                                    "report_id": "$report_id",
                                    "call_id": "$call_id",
                                    "chat_id": "$chat_id",
                                    "settlement_id": "$settlement_id"
                                }
                            },
                            transaction_amt: { $sum: "$transaction_amt" },
                            data: { $first: "$$ROOT" }
                        }
                    },
                    {
                        $project: {
                            _id: "$data._id",
                            transaction_amt: 1,
                            transaction_type: "$data.transaction_type",
                            consumer_id: "$data.consumer_id",
                            astrologer_id: "$data.astrologer_id",
                            report_id: "$data.report_id",
                            call_id: "$data.call_id",
                            chat_id: "$data.chat_id",
                            product_order_id: "$data.product_order_id",
                            service_req_id: "$data.service_req_id",
                            payment_status: "$data.payment_status",
                            payment_type: "$data.payment_type",
                            pay_type: "$data.pay_type",
                            client_transaction_amt: "$data.client_transaction_amt",
                            createdAt: "$data.createdAt",
                            updatedAt: "$data.updatedAt",
                            settlement_id: "$data.settlement_id"
                        }
                    },
                    { '$sort': { "createdAt": -1 } },
                    { $skip: skipPage }, { $limit: perPage }
                ],
                all_count: [
                    { $match: { month: currentMonth, year: currentYear } },
                    { $match: { "$or": [{ "transaction_type": "chat" }, 
                    { "transaction_type": "settlement" }, { "transaction_type": "audio" }, { "transaction_type": "video" }, { "$and": [{ "transaction_type": "report" }, { "report_id.report_status": "Approved" }] }, { "$and": [{ "transaction_type": "service" }, { "service_req_id.service_status": "Completed" }] }, { "$and": [{ "transaction_type": "tip" }, { "payment_status": "success" }] }] } },
                    { '$sort': { "createdAt": -1 } },
                    {
                        $group: {
                            _id: {
                                "_id": {
                                    "service_req_id": "$service_req_id",
                                    "product_order_id": "$product_order_id",
                                    "report_id": "$report_id",
                                    "call_id": "$call_id",
                                    "chat_id": "$chat_id",
                                    "settlement_id": "$settlement_id"
                                }
                            },
                            transaction_amt: { $sum: "$transaction_amt" },
                            data: { $first: "$$ROOT" }
                        }
                    },
                    {
                        $project: {
                            _id: "$data._id",
                            transaction_amt: 1,
                            transaction_type: "$data.transaction_type",
                            consumer_id: "$data.consumer_id",
                            astrologer_id: "$data.astrologer_id",
                            report_id: "$data.report_id",
                            call_id: "$data.call_id",
                            chat_id: "$data.chat_id",
                            product_order_id: "$data.product_order_id",
                            service_req_id: "$data.service_req_id",
                            payment_status: "$data.payment_status",
                            payment_type: "$data.payment_type",
                            pay_type: "$data.pay_type",
                            client_transaction_amt: "$data.client_transaction_amt",
                            createdAt: "$data.createdAt",
                            updatedAt: "$data.updatedAt",
                            settlement_id: "$data.settlement_id"
                        }
                    },
                    {
                        $count: 'count'
                    },
                    { $skip: skipPage }, { $limit: perPage }
                ]
            }
        },
        { $unwind: { path: "$last_settlement", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$current_month", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$previous_month", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$settled_data", preserveNullAndEmptyArrays: true } },
        { $unwind: { path: "$all_count", preserveNullAndEmptyArrays: true } }
    ])

    console.log('getEarning data', data)

    return data
}

module.exports.getHomeCount = async (req, cb) => {
    console.log('getHomeCount req.body ', req.body);
    console.log('getHomeCount req.user ', req.user);

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    //to get start and end date
    var start = moment.tz(date, helper.getTimezone()).startOf('day').toDate()
    var end = moment.tz(date, helper.getTimezone()).endOf('day').toDate()

    console.log('getHomeCount start ', start, end);

    var monthMatchQuery = { $match: {} }
    var matchQuery = { $match: { "astrologer_id": ObjectId(req.user._id) } }
    var groupBy = {
        astrologer_id: "$astrologer_id"
    }
    if (req.body.type == "today") {
        monthMatchQuery = { $match: { updatedAt: { $gte: start, $lte: end } } }
    }
    if (req.body.type == "month") {
        monthMatchQuery = { $match: { month: month, year: year } }
        groupBy = {
            year: "$year",
            month: "$month",
            consumer_id: "$astrologer_id"
        }
    }

    let data = await transaction.aggregate([
        matchQuery,
        {
            $project: {
                year: {
                    $year: "$updatedAt"
                },
                month: {
                    $month: "$updatedAt"
                },
                transaction_amt: 1,
                updatedAt: 1,
                astrologer_id: 1,
                chat_id: 1,
                service_req_id: 1,
                report_id: 1,
                transaction_type: 1
            }
        },
        monthMatchQuery,
        {
            '$lookup':
            {
                localField: "service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "service_req_id",

            }
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "report_id",
                foreignField: "_id",
                from: "reports",
                as: "report_id",

            }
        },
        { $unwind: { path: "$report_id", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "chat_id",
                foreignField: "_id",
                from: "chats",
                as: "chat_id",

            }
        },
        { $unwind: { path: "$chat_id", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: groupBy,
                "chatCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, 1, 0] }
                },
                "newChatCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "chat"] }, { "$eq": ["$chat_id.request_status", "Requested"] }] }, 1, 0] }
                },
                "chatAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "chat"] }, "$transaction_amt", 0] }
                },
                "audioCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, 1, 0] }
                },
                "audioAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "audio"] }, "$transaction_amt", 0] }
                },
                "reportCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "report"] }, 1, 0] }
                },
                "reportAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "report"] }, "$transaction_amt", 0] }
                },
                "videoCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, 1, 0] }
                },
                "videoAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "video"] }, "$transaction_amt", 0] }
                },
                "newRequestCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "service"] }, { "$eq": ["$service_req_id.service_status", "Scheduled"] }] }, 1, 0] }
                },
                "newReportCount": {
                    "$sum": { "$cond": [{ "$and": [{ "$eq": ["$transaction_type", "report"] }, { "$eq": ["$report_id.report_status", "Ordered"] }] }, 1, 0] }
                },
                "requestCount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "service"] }, 1, 0] }
                },
                "requestAmount": {
                    "$sum": { "$cond": [{ "$eq": ["$transaction_type", "service"] }, "$transaction_amt", 0] }
                },
            }
        },
        {
            $project:
            {
                _id: 0,
                transactions: 1,
                chatCount: { $round: ['$chatCount', 0] },
                newChatCount: { $round: ["$newChatCount", 0] },
                chatAmount: { $round: ['$chatAmount', 2] },
                audioCount: { $round: ['$audioCount', 0] },
                audioAmount: { $round: ["$audioAmount", 2] },
                reportCount: { $round: ['$reportCount', 0] },
                reportAmount: { $round: ["$reportAmount", 2] },
                videoCount: { $round: ['$videoCount', 0] },
                videoAmount: { $round: ["$videoAmount", 2] },
                newRequestCount: { $round: ["$newRequestCount", 0] },
                newReportCount: { $round: ["$newReportCount", 0] },
                requestCount: { $round: ["$requestCount", 0] },
                requestAmount: { $round: ["$requestAmount", 2] },
                total_count: { $sum: ["$chatCount", "$audioCount", "$reportCount", "$videoCount", "$requestCount"] },
                total_amount: { $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount"] }
            }
        },
    ])

    console.log('getHomeCount data month', month, '--- ', data);

    return data
}

module.exports.getHomeCountUser = async (req, cb) => {
    console.log('getHomeCountUser req.body ', req.body);
    console.log('getHomeCountUser req.user ', req.user);

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    //to get start and end date
    var start = moment.tz(date, helper.getTimezone()).startOf('day').toDate()
    var end = moment.tz(date, helper.getTimezone()).endOf('day').toDate()

    console.log('getHomeCountUser start ', start, end);

    var monthMatchQuery = { $match: {} }
    var matchQuery = { $match: { "astrologer_id": ObjectId(req.user._id) } }
    var groupBy = {
        astrologer_id: "$astrologer_id"
    }
    if (req.body.type == "today") {
        monthMatchQuery = { $match: { updatedAt: { $gte: start, $lte: end } } }
    }
    if (req.body.type == "month") {
        monthMatchQuery = { $match: { month: month, year: year } }
        groupBy = {
            year: "$year",
            month: "$month",
            consumer_id: "$astrologer_id"
        }
    }

    let data = await userModel.aggregate( // 1. Use any collection containing at least one document.
        [
            { $limit: 1 }, // 2. Keep only one document of the collection.
            { $project: { _id: '$$REMOVE' } }, // 3. Remove everything from the document.

            // 4. Lookup collections to union together.
            { $lookup: { from: 'calldetails', pipeline: [matchQuery, { $match: { call_audio_video: "audio" } }, { $addFields: { collection_type: "audio" } }], as: 'audio' } },
            { $lookup: { from: 'calldetails', pipeline: [matchQuery, { $match: { call_audio_video: "video" } }, { $addFields: { collection_type: "video" } }], as: 'video' } },
            { $lookup: { from: 'servicerequests', pipeline: [matchQuery, { $addFields: { collection_type: "service" } }], as: 'services' } },
            { $lookup: { from: 'chats', pipeline: [matchQuery, { $addFields: { collection_type: "chat" } }], as: 'chats' } },
            { $lookup: { from: 'reports', pipeline: [matchQuery, { $addFields: { collection_type: "report" } }], as: 'reports' } },
            { $lookup: { from: 'productorders', pipeline: [matchQuery, { $addFields: { collection_type: "order" } }], as: 'productorders' } },
            { $lookup: { from: 'users', pipeline: [matchQuery, { $addFields: { collection_type: "user" } }], as: 'users' } },

            // 5. Union the collections together with a projection.
            {
                $project:
                {
                    union: { $concatArrays: ["$audio", "$video", "$services", "$chats", "$reports", "$productorders"] }
                }
            },
            // 6. Unwind and replace root so you end up with a result set.
            { $unwind: '$union' },
            { $replaceRoot: { newRoot: '$union' } },
            {
                $addFields: {
                    year: {
                        $year: "$updatedAt"
                    },
                    month: {
                        $month: "$updatedAt"
                    }
                }
            },
            monthMatchQuery,
            {
                $lookup: {
                    from: "users",
                    localField: "astrologer_id",
                    foreignField: "_id",
                    as: "astrologer_id"
                }
            },
            {
                $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true }
            },
            {
                $group: {
                    _id: groupBy,
                    "chatCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "chat"] }, 1, 0] }
                    },
                    "newChatCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "chat"] }, { "$eq": ["$request_status", "Requested"] }] }, 1, 0] }
                    },
                    "chatAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "chat"] }, "$chat_rate", 0] }
                    },
                    "audioCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "audio"] }, 1, 0] }
                    },
                    "audioAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "audio"] }, "$call_rate", 0] }
                    },
                    "reportCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "report"] }, 1, 0] }
                    },
                    "reportAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "report"] }, "$report_rate", 0] }
                    },
                    // "reportCount": {
                    //     "$sum": { "$cond":[ {"$and" : [{ "$eq": ["$collection_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, 1, 0] }
                    // },
                    // "reportAmount": {
                    //     "$sum": { "$cond":[ {"$and" : [{ "$eq": ["$collection_type", "report"] }, { "$eq": ["$report_id.report_status", "Approved"] }] }, "$report_rate", 0] }
                    // },
                    "videoCount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "video"] }, 1, 0] }
                    },
                    "videoAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "video"] }, "$call_rate", 0] }
                    },
                    "approvedRequestCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "service"] }, { "$eq": ["$service_status", "Completed"] }] }, 1, 0] }
                    },
                    "otherRequestCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "service"] }, { "$ne": ["$service_status", "Completed"] }] }, 1, 0] }
                    },
                    "newRequestCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "service"] }, { "$or": [{ "$eq": ["$service_status", "Scheduled"] }, { "$eq": ["$service_status", "Started"] }] }] }, 1, 0] }
                    },
                    // "newRequestCount": {
                    //     "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "service"] }, { "$eq": ["$service_status", "Scheduled"] }] }, 1, 0] }
                    // },
                    "newReportCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "report"] }, { "$or": [{ "$eq": ["$report_status", "Ordered"] }, { "$eq": ["$report_status", "Rejected"] }] }] }, 1, 0] }
                    },
                    "requestCount": {
                        "$sum": { "$cond": [{ "$and": [{ "$eq": ["$collection_type", "service"] }, { "$ne": ["$service_status", "Approved"] }] }, 1, 0] }
                    },
                    "requestAmount": {
                        "$sum": { "$cond": [{ "$eq": ["$collection_type", "service"] }, "$rate", 0] }
                    }
                }
            },
            {
                $facet: {
                    data: [
                        {
                            $project:
                            {
                                _id: 1,
                                transactions: 1,
                                chatCount: { $round: ['$chatCount', 0] },
                                newChatCount: { $round: ["$newChatCount", 0] },
                                chatAmount: { $round: ['$chatAmount', 2] },
                                audioCount: { $round: ['$audioCount', 0] },
                                audioAmount: { $round: ["$audioAmount", 2] },
                                reportCount: { $round: ['$reportCount', 0] },
                                reportAmount: { $round: ["$reportAmount", 2] },
                                videoCount: { $round: ['$videoCount', 0] },
                                videoAmount: { $round: ["$videoAmount", 2] },
                                approvedRequestCount: { $round: ["$approvedRequestCount", 0] },
                                otherRequestCount: { $round: ["$otherRequestCount", 0] },
                                newRequestCount: { $round: ["$newRequestCount", 0] },
                                newReportCount: { $round: ["$newReportCount", 0] },
                                requestCount: { $round: ["$requestCount", 0] },
                                requestAmount: { $round: ["$requestAmount", 2] },
                                total_count: { $sum: ["$chatCount", "$audioCount", "$reportCount", "$videoCount", "$requestCount"] },
                                total_amount: { $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount"] },
                            }
                        }
                    ],
                    newAudio: [
                        {
                            $project:
                            {
                                subscribed_users: "$_id.astrologer_id.subscribed_users"
                            }
                        },
                        {
                            $unwind: { path: "$subscribed_users", preserveNullAndEmptyArrays: true }
                        },

                        {
                            $group: {
                                _id: "$subscribed_users.service_type",
                                newAudioCount: { $sum: { "$cond": [{ "$and": [{ $gte: ["$subscribed_users.date", start] }, { $lte: ["$subscribed_users.date", end] }] }, 1, 0] } },
                                trans: {
                                    $push:
                                    {
                                        _id: "$subscribed_users.consumer_id",
                                    }
                                }
                            },
                        }
                    ]
                }
            },
            { $unwind: { path: "$data", preserveNullAndEmptyArrays: true } },
        ]);

    console.log('getHomeCountUser data month', month, '--- ', data);

    return data
}

module.exports.getPendingTransactions = async (query, cb) => {

    let data = await transaction.aggregate([
        {
            $match: {
                $and: [
                    // { settlement_id: { $ne: null } },
                    { settlement_id: null },
                    {
                        $or: [
                            { transaction_type: 'chat' },
                            { transaction_type: 'report' },
                            { transaction_type: 'audio' },
                            { transaction_type: 'video' },
                            { transaction_type: 'service' },
                            { transaction_type: 'tip' }
                        ]
                    }
                ]
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "astrologer_id",
                foreignField: "_id",
                as: "astrologer_id"
            }
        },
        {
            $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $group: {
                _id: "$astrologer_id",
                total: { $sum: "$transaction_amt" },
                txn_ids: { $push: "$$ROOT" }
            }
        },
        { $project: { _id: 1, total_amt: "$total", txn_ids: "$txn_ids._id" } }
    ]).then(result => result)

    return data
}

module.exports.getStats = async (req) => {

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    console.log('getTransactions month ', month, year);

    var matchQuery = { $match: { $or: [{ payment_status: "success" }, { payment_status: "success" }] } } //{ payment_status: "failed" }
    if (req.user.user_type == 'consumer') {
        matchQuery = { $match: { $and: [{ consumer_id: ObjectId(req.user._id) }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
    }
    else if (req.user.user_type == 'astrologer') {
        matchQuery = { $match: { $and: [{ astrologer_id: ObjectId(req.user._id) }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
    }
    if (req.user.user_type == 'admin') {
        matchQuery = {
            $match: {
                $and: [
                    {
                        $or: [
                            { payment_status: "success" },
                            { payment_status: "success" }
                        ]
                    },
                    { $expr: { $ne: ["$transaction_type", "wallet"] } },
                    { $expr: { $ne: ["$transaction_type", "deposit"] } }
                ]
            }
        }
    }

    if (req.body.filter_type == "wallet") {
        matchQuery = { $match: { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] } }
        if (req.user.user_type == 'consumer') {
            matchQuery = { $match: { $and: [{ consumer_id: ObjectId(req.user._id) }, { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
        }
        if (req.user.user_type == 'astrologer') {
            matchQuery = { $match: { $and: [{ astrologer_id: ObjectId(req.user._id) }, { $or: [{ transaction_type: "wallet" }, { payment_type: "wallet" }] }, { $or: [{ payment_status: "success" }, { payment_status: "success" }] }] } }
        }
    }

    let matchQuery1 = {}
    if(req.body.type && req.body.type != ''){
        matchQuery1 = { ...matchQuery1, 'transaction_type': { $eq: req.body.type } }
    }

    if(req.body.astrologerId && req.body.astrologerId != ''){
        matchQuery1 = { ...matchQuery1, 'astrologer_id': ObjectId(req.body.astrologerId) }
    }
    
    let searchQuery = {}
    if(req.body.searchText && req.body.searchText != ''){
        searchQuery = { ...searchQuery, $or: [ { 'consumer_id.mobile': { $regex: req.body.searchText, $options: 'i' } }, {'consumer_id.first_name': { $regex: req.body.searchText, $options: 'i' } }  ] }
    }

    let data = await transaction.aggregate([
        matchQuery,
        {
            $match: matchQuery1
        },
        {
            $addFields: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" }
            }
        },
        {
            $match: {
                year: year,
                month: month
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "consumer_id",
                foreignField: "_id",
                as: "consumer_id"
            }
        },
        {
            $unwind: { path: "$consumer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $match: searchQuery
        },
        {
            "$group": {
                _id: null,
                total: { $sum: { $toDouble: "$client_transaction_amt" } },
                count: { $sum: 1 }
            }
        },
        {
            $project: {
                total: 1,
                count: 1
            }
        }
    ])

    return data
}