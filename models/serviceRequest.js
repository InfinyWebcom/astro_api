var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    service_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'service'
    },
    consumer_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    astrologer_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    service_status: {
        type: String,
        enum: ['New', 'Approved', 'Scheduled', 'Started', 'StartedOne', 'Denied', 'Cancelled', 'Completed']
    },
    rate: Number,
    service_time: Date,
    assigned_time: Date,
    payment_status: {
        type: String,
        enum: ['pending', 'success', 'failed']
    },
    tip: Number,
    product_number: String,
    otp: Number, //to complete request by adding otp
    remain_amt: Number, //amount remaining for payment link transaction
    pay_order_id: String, //razor pay order id
    pay_receipt: String, //razor pay receipt
    pay_payment_id: String,  //razor pay payment id
    partial_order_id: String, //razor pay order id
    partial_receipt: String, //razor pay receipt
    partial_payment_id: String,  //razor pay payment id
    user_address: {
        block_number: String,
        building_name: String,
        street_address: String,
        pincode: String,
        user_city: String,
        user_state: String,
        user_location: {
            type: [Number],
            index: '2dsphere'
        },
        shipping_name: String,
        shipping_number: String,
    }
},
    {
        timestamps: true
    });

const serviceRequest = module.exports = mongoose.model('serviceRequest', schema);

module.exports.getRequests = async (req, cb) => {

    // for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    var matchQuery = { $match: { consumer_id: ObjectId(req.user._id) } }

    if (req.user.user_type == 'admin') {
        matchQuery = { $match: {} }
    }
    if (req.user.user_type == 'astrologer') {
        matchQuery = { $match: { astrologer_id: ObjectId(req.user._id) } }
    }

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    console.log('getRequests month ', month, year);

    let aggQuery = []

    aggQuery.push(matchQuery)

    if (req.user.user_type == "admin") {
        aggQuery.push(
            { $match: { "service_status": req.body.status } }
        )
    }
    if (req.user.user_type == "admin" && req.body.status != 'New' && req.body.status != 'Approved' && req.body.status != 'Scheduled') {
        aggQuery.push(
            {
                $addFields: {
                    year: { $year: "$service_time" },
                    month: { $month: "$service_time" }
                }
            },
            {
                $match: {
                    year: year,
                    month: month
                }
            }
        )
    }

    let service_status_order = 1;
    if (req.body.filter == 'active') {
        if (req.user.user_type == 'consumer') {
            aggQuery.push(
                {
                    $match: {
                        $or: [
                            { service_status: 'New' },
                            { service_status: 'Approved' },
                            { service_status: 'Scheduled' },
                            { service_status: 'Started' }
                        ]
                    }
                },
            )

            service_status_order = {
                "$switch": {
                    "branches": [
                        { "case": { "$eq": ["$service_status", "Started"] }, "then": 1 },
                        { "case": { "$eq": ["$service_status", "Scheduled"] }, "then": 2 },
                        { "case": { "$eq": ["$service_status", "Approved"] }, "then": 3 },
                        { "case": { "$eq": ["$service_status", "New"] }, "then": 4 },
                    ],
                    "default": 1
                }
            }

        }
        else if (req.user.user_type == 'astrologer') {
            aggQuery.push(
                {
                    $match: {
                        $or: [
                            { service_status: 'Scheduled' },
                            { service_status: 'Started' }
                        ]
                    }
                },
            )

            service_status_order = {
                "$switch": {
                    "branches": [
                        { "case": { "$eq": ["$service_status", "Started"] }, "then": 1 },
                        { "case": { "$eq": ["$service_status", "Scheduled"] }, "then": 2 },
                    ],
                    "default": 1
                }
            }

        }
    }
    else if (req.body.filter == 'history') {
        aggQuery.push(
            {
                $match: {
                    $or: [
                        { service_status: 'Completed' },
                        { service_status: 'Cancelled' },
                        { service_status: 'Denied' },
                    ]
                }
            },
        )
        service_status_order = {
            "$switch": {
                "branches": [
                    { "case": { "$eq": ["$service_status", "Completed"] }, "then": 1 },
                    { "case": { "$eq": ["$service_status", "Cancelled"] }, "then": 1 },
                    { "case": { "$eq": ["$service_status", "Denied"] }, "then": 1 },
                ],
                "default": 1
            }
        }
    }

    aggQuery.push(
        {
            $project: {
                service_id: 1,
                service_time: 1,
                consumer_id: 1,
                astrologer_id: 1,
                rate: 1,
                product_number: 1,
                pay_order_id: 1,
                pay_receipt: 1,
                payment_status: 1,
                createdAt: 1,
                updatedAt: 1,
                pay_payment_id: 1,
                service_status: 1,
                assigned_time: 1,
                otp: 1,
                tip: 1,
                rating: 1,
                user_address: 1,
                service_status_order: service_status_order
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
            $lookup: {
                from: "services",
                localField: "service_id",
                foreignField: "_id",
                as: "service_id"
            }
        },
        {
            $unwind: { path: "$service_id", preserveNullAndEmptyArrays: true }
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
                localField: "_id",
                foreignField: "service_req_id",
                from: "ratings",
                as: "rating"
            }
        },
        {
            $unwind: { path: "$rating", preserveNullAndEmptyArrays: true }
        },
    )

    if (req.body.filter == 'active') {
        aggQuery.push(
            { "$sort": { "service_status_order": 1, "service_time": 1 } },
        )
    }
    else if ((req.user.user_type == 'admin') && (req.body.status == 'New' || req.body.status == 'Approved' || req.body.status == 'Scheduled')) {
        aggQuery.push(
            { "$sort": { "service_status_order": 1, "service_time": 1 } },
        )
    }
    else {
        aggQuery.push(
            { "$sort": { "service_status_order": 1, "service_time": -1 } },
        )
    }

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
        },
        { $unwind: "$totalCount" },
        {
            $project: {
                data: 1,
                totalCount: "$totalCount.count"
            }
        }
    )

    let data = await serviceRequest.aggregate(aggQuery)

    return data
}

module.exports.getRequestById = async (req, cb) => {
    console.log('getRequestById req --- ', req);

    let data = await serviceRequest.findOne({ _id: req.request_id })
        .populate('consumer_id')
        .populate('astrologer_id')
        .populate('service_id')
        .then(result => result)

    console.log('getRequestById data --- ', data);

    return data
}

module.exports.getRequestByQuery = async (query, cb) => {
    console.log('getRequestByQuery req --- ', query);

    let data = await serviceRequest.find(query)
        .populate('consumer_id')
        .populate('astrologer_id')
        .populate('service_id')
        .then(result => result)

    return data
}

module.exports.getRequestsCount = async (req, cb) => {
    let data = await serviceRequest.countDocuments({ is_deleted: false }).then(result => result)

    return data
}

module.exports.getRequestByRazorId = async (req, cb) => {
    console.log('getRequestByRazorId req --- ', req);

    let data = await serviceRequest.findOne(req)
        .populate('consumer_id')
        .populate('astrologer_id')
        .populate('service_id')
        .then(result => result)

    console.log('getRequestByRazorId data --- ', data);

    return data
}

module.exports.getNewRequests = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 5
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await serviceRequest.aggregate([
        { $match: { "service_status": 'New' } },
        { "$sort": { "service_time": 1 } },
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
            $lookup: {
                from: "services",
                localField: "service_id",
                foreignField: "_id",
                as: "service_id"
            }
        },
        {
            $unwind: { path: "$service_id", preserveNullAndEmptyArrays: true }
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

    return data
}

module.exports.getFirstRequest = async (req, cb) => {
    console.log('getFirstRequest req --- ', req);

    let data = await serviceRequest.findOne({})
        .sort({ createdAt: 1 })
        .then(result => result)

    console.log('getFirstRequest data --- ', data);

    return data
}

module.exports.getLastRequest = async (req, cb) => {
    console.log('getFirstRequest req --- ', req);

    let data = await serviceRequest.findOne({})
        .sort({ createdAt: -1 })
        .then(result => result)

    console.log('getFirstRequest data --- ', data);

    return data
}