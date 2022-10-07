var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const productOrderModel = require('../models/productOrder');

var schema = new Schema({
    name: {
        type: String,
        required: false
    },
    description: String,
    rate: Number,
    is_deleted: {
        type: Boolean,
        default: false
    },
    is_hidden: {
        type: Boolean,
        default: false
    },
    image_url: String
},
    {
        timestamps: true
    });

const product = module.exports = mongoose.model('product', schema);

module.exports.getProducts = async (req, cb) => {
    let data = await product.aggregate([
        {
            $match:
            {
                is_deleted: false
            }
        },
        {
            $addFields:
            {
                order_count: 0
            }
        }
    ])

    return data
}

module.exports.getOrderPerProduct = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await productOrderModel.aggregate([
        { $unwind: { path: "$products", preserveNullAndEmptyArrays: true } },
        {
            '$lookup':
            {
                localField: "products.product_id",
                foreignField: "_id",
                from: "products",
                as: "product_id"
            }
        },
        { $unwind: { path: "$product_id", preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: "$products.product_id",
                order_count: { $sum: 1 }
            }
        },
        {
            '$lookup': {
                localField: "_id",
                foreignField: "_id",
                from: "products",
                as: "p_id"
            }
        },
        { $unwind: { path: '$p_id', preserveNullAndEmptyArrays: true } },
        {
            $project:
            {
                "_id": 1,
                order_count: 1,
                "name": "$p_id.name",
                "is_deleted": "$p_id.is_deleted",
                "is_hidden": "$p_id.is_hidden",
                "description": "$p_id.description",
                "rate": "$p_id.rate",
                "image_url": "$p_id.image_url",
                "createdAt": "$p_id.createdAt",
                "updatedAt": "$p_id.updatedAt",
            }
        },
        { $skip: skipPage },
        { $limit: perPage }
    ])

    return data
}

module.exports.getProductsCount = async (req, cb) => {
    let data = await product.countDocuments({ is_deleted: false }).then(result => result)

    return data
}

module.exports.getProductById = async (req, cb) => {
    console.log('getProductById req --- ', req);

    let data = await product.findOne({ _id: req.product_id }).then(result => result)

    console.log('getProductById data --- ', data);

    return data
}

module.exports.getProductList = async (req, cb) => {

    // FOR PAGINATION
    let perPage = req.body.perPage ? parseInt(req.body.perPage) : 10;
    let page = req.body.page ? parseInt(req.body.page) : 1;
    let skipPage = (page - 1) * perPage;

    let search = req.body.searchText == undefined ? '' : req.body.searchText;

    let matchQuery = { $match: {} }

    if (req.user_type == 'admin') {
        matchQuery = {
            $match: {
                'name': { $regex: search, $options: 'i' },
                is_deleted: false,
            }
        }
    }
    else {
        matchQuery = {
            $match: {
                'name': { $regex: search, $options: 'i' },
                is_deleted: false,
                is_hidden: false
            }
        }
    }


    let data = await product.aggregate([
        matchQuery,
        { $sort: { name: 1 } },
        {
            $addFields: {
                order_count: 0
            }
        },
        {
            $facet: {
                data: [{ $skip: skipPage }, { $limit: perPage }],
                totalCount: [{ $count: 'count' }]
            }
        },
        { $unwind: "$totalCount" },
        {
            $project: {
                data: 1,
                total_count: "$totalCount.count"
            }
        }
    ])
        .then(result => result)

    return data
}