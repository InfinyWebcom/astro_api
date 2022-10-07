const { query } = require('express-validator');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    order_number: {
        type: String,
        required: true
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    user_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    consumer_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    products: [{
        product_id: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'product'
        },
        quantity: Number,
        rate: Number
    }],
    total_amount: Number,
    payment_status: {
        type: String,
        enum: ['pending', 'success', 'failed']
    },
    order_status: [{
        status: {
            type: String,
            default: 'New'
        },
        description: String,
        date: Date,
    }],
    current_status: {
        type: String,
        enum: ['New', 'Processed', 'Others', 'Delivered', 'Cancelled']
    },
    is_viewed: Boolean,
    pay_order_id: String, //razor pay order id
    pay_receipt: String, //razor pay receipt
    pay_payment_id: String,  //razor pay payment id
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
    },
    invoice_name: String,
},
    {
        timestamps: true
    });

const productOrder = module.exports = mongoose.model('productOrder', schema);

module.exports.getOrders = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10;
    var page = req.body.page ? parseInt(req.body.page) : 1;
    var skipPage = (page - 1) * perPage;

    var matchQuery = {
        $match: {
            user_id: ObjectId(req.user._id),
            "current_status": req.body.status,
            order_status: { $gt: [] }
        }
    }
    if (req.user.user_type == 'admin') {
        matchQuery = { $match: { "current_status": req.body.status, order_status: { $gt: [] } } }
    }

    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()

    console.log('getOrders month ', month, year);

    if (req.body.status == 'New') {
        productOrder.updateMany({ current_status: 'New', is_viewed: false }, { is_viewed: true }).then(result => console.log(result))
    }

    let aggQuery = []
    if (req.user.user_type == "consumer") {
        aggQuery.push(
            {
                $match: {
                    user_id: ObjectId(req.user._id),
                    order_status: { $gt: [] },
                }
            }
        )

        if (req.body.status !== "all") {
            aggQuery.push(
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
                }
            )
        }
    }
    else {
        if (req.user.user_type == 'admin') {
            aggQuery.push(matchQuery)
            if (req.body.status != 'New' && req.body.status != 'Processed') {
                aggQuery.push(
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
                    }
                )
            }
        }
        else {

            aggQuery.push(
                matchQuery,
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
                }
            )
        }

    }
    aggQuery.push(
        {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_id"
            }
        },
        {
            $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true }
        },
        {
            $project: {
                is_deleted: 1,
                order_number: 1,
                user_id: 1,
                products: 1,
                is_viewed: 1,
                order_status: 1,
                total_amount: 1,
                current_status: 1,
                pay_order_id: 1,
                pay_receipt: 1,
                payment_status: 1,
                createdAt: 1,
                updatedAt: 1,
                __v: 1,
                year: {
                    $year: "$updatedAt"
                },
                month: {
                    $month: "$updatedAt"
                },
                current_status_order: {
                    "$switch": {
                        "branches": [
                            { "case": { "$eq": ["$current_status", "New"] }, "then": 1 },
                            { "case": { "$eq": ["$current_status", "Processed"] }, "then": 2 },
                            { "case": { "$eq": ["$current_status", "Others"] }, "then": 3 },
                            { "case": { "$eq": ["$current_status", "Delivered"] }, "then": 4 },
                            { "case": { "$eq": ["$current_status", "Cancelled"] }, "then": 5 },
                        ],
                        "default": 1
                    }
                }
            }
        },
        { "$sort": { "current_status_order": 1, "createdAt": 1 } },
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
    let data = await productOrder.aggregate(aggQuery)

    return data
}

module.exports.getOrdersCount = async (req, cb) => {
    let data = await productOrder.countDocuments({ is_deleted: false }).then(result => result)

    return data
}

module.exports.getNewOrdersCount = async (req, cb) => {
    let data = await productOrder.countDocuments({ is_viewed: false }).then(result => result)

    console.log('getNewOrdersCount data --- ', data);
    return data
}

module.exports.getNewOrders = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 5
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await productOrder.aggregate([
        { $match: { "current_status": 'New' } },
        { "$sort": { "updatedAt": -1 } },
        {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_id"
            }
        },
        {
            $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true }
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

    console.log('getNewOrders data --- ', data);
    return data
}

module.exports.getOrderById = async (req, cb) => {
    console.log('getOrderById req --- ', req);

    let data = await productOrder.findOne({ _id: req.order_id })
        .populate('user_id')
        .populate('products.product_id')
        .then(result => result)

    console.log('getOrderById data --- ', data);

    return data
}

module.exports.getOrderByQuery = async (query, cb) => {
    console.log('getOrderByRazorId query --- ', query);

    let data = await productOrder.findOne(query)
        .populate('user_id')
        .populate('products.product_id')
        .then(result => result)

    console.log('getOrderByRazorId data --- ', data);

    return data
}

module.exports.getFirstOrder = async (req, cb) => {
    console.log('getFirstOrder req --- ', req);

    let data = await productOrder.findOne({})
        .sort({ createdAt: 1 })
        .then(result => result)

    console.log('getFirstOrder data --- ', data);

    return data
}

module.exports.getLastOrder = async (req, cb) => {
    console.log('getFirstOrder req --- ', req);

    let data = await productOrder.findOne({})
        .sort({ createdAt: -1 })
        .then(result => result)

    console.log('getFirstOrder data --- ', data);

    return data
}