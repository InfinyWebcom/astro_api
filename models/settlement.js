var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

/* Models */
const transModel = require('../models/transaction');

var schema = new Schema({
    astrologer_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    invoice_id: {
        type: String
    },
    transaction_amt: {
        type: Number,
        default: 0
    },
    tds: {
        type: Number,
        default: 1
    },
    tcs: {
        type: Number,
        default: 1
    },
    commission: {
        type: Number,
        default: 1
    },
    net_amt: {
        type: Number,
        default: 0
    },
    payment_date: Date,
    transaction_ids: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'transaction'
    }],
    remark: {
        type: String,
        default: false
    },
    title: String,
    razor_fee: Number,
    razor_tax: Number
},
    {
        timestamps: true
    });

const settlement = module.exports = mongoose.model('settlement', schema);

module.exports.getOverallDetails = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await transModel.aggregate([
        {
            $project: {
                _id: 1,
                _id: "$_id",
                consumer_id: "$consumer_id",
                "astrologer_id": "$astrologer_id",
                "chat_id": "$chat_id",
                "report_id": "$report_id",
                "service_req_id": "$service_req_id",
                "transaction_type": "$transaction_type",
                "transaction_amt": "$transaction_amt",
                "createdAt": "$createdAt",
                "updatedAt": "$updatedAt",
                "settlement_id": "$settlement_id",
                is_settle: { $ifNull: ["$settlement_id", "Unspecified"] }
            }
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
                _id: "$astrologer_id",
                //    total_amount: { $sum: "$transaction_amt"  },
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
                /*
                "pending_amount": {
                    "$sum": { "$cond":[{ "$eq": ["$is_settle", false] }, "$transaction_amt", 0] }
                },*/
                "settled_amount": {
                    "$sum": { "$cond": [{ "$and": [{ "$ne": ["$is_settle", "Unspecified"] }, { "$ne": ["$transaction_type", "settlement"] }] }, "$transaction_amt", 0] }
                },
                transactions: {
                    $push: {
                        _id: "$_id",
                        consumer_id: "$consumer_id",
                        "astrologer_id": "$astrologer_id",
                        "chat_id": "$chat_id",
                        "transaction_type": "$transaction_type",
                        "transaction_amt": "$transaction_amt",
                        "createdAt": "$createdAt",
                        "updatedAt": "$updatedAt",
                        "settlement_id": "$settlement_id",
                        "is_settle": "$is_settle"
                    }
                },
            }
        },
        {
            $project: {
                _id: 1,
                //   total_amount: { $round: [ '$total_amount', 2 ]},
                //   pending_amount: { $round: [ '$pending_amount', 2 ]},
                pending_amount: { $round: [{ $subtract: [{ $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount"] }, '$settled_amount'] }, 0/*2*/] },
                settled_amount: { $round: ['$settled_amount', 0/*2*/] },
                total_amount: { $round: [{ $sum: ["$chatAmount", "$audioAmount", "$reportAmount", "$videoAmount", "$requestAmount"] }, 0/*2*/] },
                transactions: 1
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "astrologer_id"
            }
        },
        {
            $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true }
        },
        {
            $unwind: { path: "$_id" }
        },
        { $sort: { total_amount: -1 } },
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

module.exports.getSettlementsNew = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()
    let query = [{ $match: { "astrologer_id": ObjectId(req.body.astrologer_id) } },
    { "$sort": { "updatedAt": -1 } },
    {
        '$lookup':
        {
            localField: "settlement_id",
            foreignField: "_id",
            from: "settlements",
            as: "settlement_id"
        }
    },
    { $unwind: { path: "$settlement_id", preserveNullAndEmptyArrays: true } },
    {
        '$lookup':
        {
            localField: "consumer_id",
            foreignField: "_id",
            from: "users",
            as: "consumer_id"
        }
    },
    { $unwind: { path: "$consumer_id", preserveNullAndEmptyArrays: true } },
    {
        '$lookup':
        {
            localField: "chat_id",
            foreignField: "_id",
            from: "chats",
            as: "chat_id"
        }
    },
    { $unwind: { path: "$chat_id", preserveNullAndEmptyArrays: true } },
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
            as: "service_req_id"
        }
    },
    { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true } },
    {
        '$lookup':
        {
            localField: "service_req_id.service_id",
            foreignField: "_id",
            from: "services",
            as: "service_req_id.service_id"
        }
    }]
    console.log('getSettlements month ', month, year);
    if (req.body.type == 'open') {
        query.push({ $unwind: { path: "$service_req_id.service_id", preserveNullAndEmptyArrays: true } })
        query.push({
            $match: {
                $or: [{ transaction_type: "chat" }, { transaction_type: "audio" }, { transaction_type: "video" },
                { $and: [{ transaction_type: "report" }, { "report_id.report_status": "Approved" }] },
                { $and: [{ transaction_type: "service" }, { "service_req_id.service_status": "Completed" }] }],
                settlement_id: null
            }
        })
        query.push(
            // { "$sort": { "is_settle": 1 } },
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
            })
    } else {
        query.push({ $unwind: { path: "$service_req_id.service_id", preserveNullAndEmptyArrays: true } })
        query.push({
            $match: {
                $or: [{ transaction_type: "chat" }, { transaction_type: "audio" }, { transaction_type: "video" },
                { $and: [{ transaction_type: "report" }, { "report_id.report_status": "Approved" }] },
                { $and: [{ transaction_type: "service" }, { "service_req_id.service_status": "Completed" }] }]
            }
        })
        query.push({
            $group: {
                _id: "$settlement_id._id",
                total_amount: { $sum: "$transaction_amt" },
                trans: {
                    $push: {
                        _id: "$_id",
                        consumer_id: "$consumer_id",
                        "astrologer_id": "$astrologer_id",
                        "chat_id": "$chat_id",
                        "call_id": "$call_id",
                        "report_id": "$report_id",
                        "service_req_id": "$service_req_id",
                        "transaction_type": "$transaction_type",
                        "transaction_amt": "$transaction_amt",
                        "client_transaction_amt": "$client_transaction_amt",
                        "createdAt": "$createdAt",
                        "updatedAt": "$updatedAt"
                    }
                },
                data: { $first: "$settlement_id" },
            }
        },
            {
                $project:
                {
                    "_id": 1,
                    trans: 1,
                    data: 1,
                    total_amount: { $round: ['$total_amount', 2] },
                    "transaction_amt": "$data.transaction_amt",
                    "client_transaction_amt": "$data.client_transaction_amt",
                    "tds": "$data.tds",
                    "tcs": "$data.tcs",
                    "commission": "$data.commission",
                    "net_amt": "$data.net_amt",
                    "remark": "$data.remark",
                    "payment_date": "$data.payment_date",
                    "createdAt": "$data.createdAt",
                    "updatedAt": "$data.updatedAt",
                    is_settle: {
                        $cond: [{ $ifNull: ['$data', false] }, 1, 0]
                    },
                    year: { $year: "$data.createdAt" },
                    month: { $month: "$data.createdAt" }
                }
            },
            {
                $match: { $or: [{ year: year, month: month }, { "is_settle": 1 }] }
            }, { "$sort": { "payment_date": -1 } },
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
            })
    }
    let data = await transModel.aggregate(query)

    console.log('getSettlements data --- ', data);

    return data
}

module.exports.getSettlements = async(req, cb)=>{
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    console.log('\n\nGET SETTLEMENTS - Month :', month, year);

    let data = await transModel.aggregate([
        { $match: {"astrologer_id" : ObjectId(req.body.astrologer_id)}},
        { "$sort": { "updatedAt": -1 } },
        { '$lookup' : 
            {
                localField: "settlement_id",
                foreignField: "_id",
                from: "settlements",
                as: "settlement_id"
            } 
        },
        { $unwind: { path: "$settlement_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "consumer_id",
                foreignField: "_id",
                from: "users",
                as: "consumer_id"
            } 
        },
        { $unwind: { path: "$consumer_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "chat_id",
                foreignField: "_id",
                from: "chats",
                as: "chat_id"
            } 
        },
        { $unwind: { path: "$chat_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "call_id",
                foreignField: "_id",
                from: "calldetails",
                as: "call_id"
            } 
        },
        { $unwind: { path: "$call_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "report_id",
                foreignField: "_id",
                from: "reports",
                as: "report_id"
            } 
        },
        { $unwind: { path: "$report_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "service_req_id"
            } 
        },
        { $unwind: { path: "$service_req_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "service_req_id.service_id",
                foreignField: "_id",
                from: "services",
                as: "service_req_id.service_id"
            } 
        },
        { $unwind: { path: "$service_req_id.service_id", preserveNullAndEmptyArrays: true }},
        { 
            $match: { $or: [{ transaction_type: "chat"}, { transaction_type: "audio"}, { transaction_type: "video"}, 
            { $and: [ { transaction_type: "report"}, { "report_id.report_status": "Approved"} ] },
            { $and: [ { transaction_type: "service"}, { "service_req_id.service_status": "Completed"} ] } ] } 
        },
        {
            $group: {
                _id: "$settlement_id._id",
                total_amount: { $sum: "$transaction_amt"  },
                trans: { $push: { _id: "$_id",
                consumer_id: "$consumer_id",
                "astrologer_id" : "$astrologer_id",
                "chat_id" : "$chat_id",
                "call_id" : "$call_id",
                "report_id" : "$report_id",
                "service_req_id" : "$service_req_id",
                "transaction_type" : "$transaction_type",
                "transaction_amt" : "$transaction_amt",
                "client_transaction_amt": "$client_transaction_amt",
                "createdAt" : "$createdAt",
                "updatedAt" : "$updatedAt" } },
                data: { $first: "$settlement_id" },
            }
        },
        { $project: 
            {
                "_id": 1,
                trans: 1,
                data: 1,
                total_amount: { $round: [ '$total_amount', 2 ]},
                "transaction_amt": "$data.transaction_amt",
                "client_transaction_amt": "$data.client_transaction_amt",
                "tds" : "$data.tds",
                "tcs" : "$data.tcs",
                "commission" : "$data.commission",
                "net_amt" : "$data.net_amt",
                "remark" : "$data.remark",
                "payment_date" : "$data.payment_date",
                "createdAt" : "$data.createdAt",
                "updatedAt" : "$data.updatedAt",
                is_settle: {
                    $cond: [ {$ifNull: ['$data', false]}, 1, 0 ]
                },
                year: { $year: "$data.createdAt" },
                month: { $month: "$data.createdAt" }
            }
        },
        {
            $match: { $or: [ { year: year,  month: month }, { "is_settle": 0.0 } ] }
        },
        { "$sort": { "payment_date": -1 } },
        { "$sort": { "is_settle": 1 } },
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