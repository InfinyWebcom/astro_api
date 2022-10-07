var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/* NODE-MODULES */
var ObjectId = mongoose.Types.ObjectId;
var moment = require('moment-timezone');
const helper = require('../lib/helper');

var schema = new Schema({
    consumer_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    astrologer_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    report_status: {
        type: String,
        enum: ['Ordered', 'Uploaded', 'Approved', 'Rejected', 'Cancelled']
    },
    report_url: String,
    payment_status: {
        type: String,
        enum: ['pending', 'success', 'failed']
    },
    report_rate: Number,
    client_report_rate: Number,
    name: String,
    birth_date: Date,
    place: String,
    astro_sign: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'astrosign'
    },
},
    {
        timestamps: true
    });

const report = module.exports = mongoose.model('report', schema);

module.exports.getReportById = async (req, cb) => {
    console.log('getReportById req --- ', req.body);

    let data = await report
        .findOne({ _id: req.body.report_id })
        .populate('astrologer_id')
        .populate('consumer_id')
        .populate({
            path: 'consumer_id',
            populate: {
                path: 'astro_sign'
            }
        })
        .then(result => result)

    console.log('getReportById data --- ', data);

    return data
}

module.exports.getReportsCount = async (req, cb) => {
    var query = {}
    if (req.body.astrologer_id && req.body.astrologer_id != "") {
        query = { astrologer_id: req.body.astrologer_id }
    }
    if (req.body.consumer_id && req.body.consumer_id != "") {
        query = { consumer_id: req.body.consumer_id }
    }

    let data = await report.countDocuments(query).then(result => result)

    return data
}

module.exports.getNewReports = async (req, cb) => {
    console.log('\n\n\n\n\n\n\ngetNewReports req --- ', req.body);

    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 5
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;
    let sort = req.body.newReport == true ? { "createdAt": -1 } : { "updatedAt": -1 }
    let data = await report.aggregate([
        { $match: { $or: [{ report_status: 'Ordered' }, { report_status: 'Uploaded' }] } },
        { "$sort": sort },
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

    console.log('getNewReports data --- ', data);

    return data
}

module.exports.getReports = async (req, cb) => {
    console.log('getReports req --- ', req);

    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    var query = {}
    let uploaded_order;
    if (req.user.user_type == 'admin' && req.body.consumer_id && req.body.consumer_id != '') {
        query = { consumer_id: ObjectId(req.body.consumer_id) }
        uploaded_order = 2;
    }
    else if (req.user.user_type == 'admin' && req.body.astrologer_id && req.body.astrologer_id != '') {
        query = { astrologer_id: ObjectId(req.body.astrologer_id) }
        uploaded_order = 2;
    }
    else if (req.user.user_type == 'consumer') {
        query = { 'consumer_id': ObjectId(req.user._id) }
        uploaded_order = 1;
    }
    else if (req.user.user_type == 'astrologer') {
        query = { 'astrologer_id': ObjectId(req.user._id) }
        uploaded_order = 2;
    }

    //to get start and end date
    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    var start = moment.tz(date, helper.getTimezone()).startOf('day').toDate()
    var end = moment.tz(date, helper.getTimezone()).endOf('day').toDate()

    console.log('getCalls start ', start, end);

    var monthMatchQuery = { $match: {} }
    if (req.body.type == "today") {
        monthMatchQuery = { $match: { updatedAt: { $gte: start, $lte: end } } }
    }
    if (req.body.type == "month") {
        monthMatchQuery = { $match: { month: month, year: year } }
    }

    let aggQuery = [];
    aggQuery.push(
        { $match: query },
        {
            $project:
            {
                year: {
                    $year: "$updatedAt"
                },
                month: {
                    $month: "$updatedAt"
                },
                consumer_id: 1,
                astrologer_id: 1,
                report_status: 1,
                report_url: 1,
                payment_status: 1,
                report_rate: 1,
                client_report_rate: 1,
                name: 1,
                birth_date: 1,
                place: 1,
                astro_sign: 1,
                updatedAt: 1,
                createdAt: 1,
                report_status_order: {
                    "$switch": {
                        "branches": [
                            { "case": { "$eq": ["$report_status", "Ordered"] }, "then": 1 },
                            { "case": { "$eq": ["$report_status", "Uploaded"] }, "then": uploaded_order },
                            { "case": { "$eq": ["$report_status", "Rejected"] }, "then": 3 },
                            { "case": { "$eq": ["$report_status", "Approved"] }, "then": 4 },
                            { "case": { "$eq": ["$report_status", "Cancelled"] }, "then": 5 },
                        ],
                        "default": 1
                    }
                }
            }
        },
        monthMatchQuery,
        { "$sort": { "report_status_order": 1, "updatedAt": -1  } },
        {
            $lookup: {
                localField: "astrologer_id",
                foreignField: "_id",
                from: "users",
                as: "astrologer_id"
            }
        },
        { $unwind: "$astrologer_id" },
        {
            $lookup: {
                localField: "consumer_id",
                foreignField: "_id",
                from: "users",
                as: "consumer_id"
            }
        },
        { $unwind: "$consumer_id" },
        {
            $lookup: {
                localField: "_id",
                foreignField: "report_id",
                from: "ratings",
                as: "rating"
            }
        },
        {
            $unwind: { path: "$rating", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                localField: "consumer_id.astro_sign",
                foreignField: "_id",
                from: "astrosigns",
                as: "consumer_id.astro_sign"
            }
        },
        { $unwind: { path: "$consumer_id.astro_sign", preserveNullAndEmptyArrays: true } }
    )
    if (req.user.user_type == "consumer" || req.user.user_type == "astrologer") {
        aggQuery.push(
            {
                $facet: {
                    data: [{ $skip: skipPage }, { $limit: perPage }],
                    totalCount: [
                        {
                            $count: 'count'
                        }
                    ]
                }
            }
        )
    } 
    else {
        aggQuery.push(
            {
                $facet: {
                    data: [{ "$match": {} }],
                    totalCount: [
                        {
                            $count: 'count'
                        }
                    ]
                }
            }
        )
    }
    aggQuery.push(
        { $unwind: "$totalCount" },
        {
            $project: {
                data: 1,
                totalCount: "$totalCount.count"
            }
        }
    )

    let data = await report
        .aggregate(aggQuery)

    console.log('getReports data --- ', data);

    return data
}