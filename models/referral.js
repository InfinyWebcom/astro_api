var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    referror_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    used_by_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    referral_code: String,
    first_transaction: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'transaction'
    }
}, {
    timestamps: true
});

const referral = module.exports = mongoose.model('referral', schema);

module.exports.getUserReferral = async(req, cb)=>{
    let data = await referral
    .findOne({ used_by_id: req.user_id })
    .populate('used_by_id')
    .populate('referror_id')
    .then( result=> result)
    
    return data
}

module.exports.getAllReferrals = async(req, cb)=>{
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    let data = await referral.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "used_by_id",
                foreignField: "_id",
                as: "used_by_id"
            }
        },
        {
            $unwind: { path: "$used_by_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "referror_id",
                foreignField: "_id",
                as: "referror_id"
            }
        },
        {
            $unwind: { path: "$referror_id", preserveNullAndEmptyArrays: true }
        },
        {
            $group: {
                _id: "$referror_id",
                data: { $first: "$$ROOT" }
              }
        },
        {
            $project: {
                "_id": "$data._id",
                referral_code: "$data.referral_code",
                createdAt: "$data.createdAt",
                referror_id: "$data.referror_id",
                used_by_id: "$data.used_by_id"
              }
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

module.exports.getDetails = async(req, cb)=>{
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    let data = await referral.aggregate([
        {
            $match: {
                referror_id: ObjectId(req.body.referror_id)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "used_by_id",
                foreignField: "_id",
                as: "used_by_id"
            }
        },
        {
            $unwind: { path: "$used_by_id", preserveNullAndEmptyArrays: true }
        },
        {
            $match: {
                "used_by_id.approval_status": "approved"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "referror_id",
                foreignField: "_id",
                as: "referror_id"
            }
        },
        {
            $unwind: { path: "$referror_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "transactions",
                localField: "first_transaction",
                foreignField: "_id",
                as: "first_transaction"
            }
        },
        {
            $unwind: { path: "$first_transaction", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "chats",
                localField: "first_transaction.chat_id",
                foreignField: "_id",
                as: "first_transaction.chat_id"
            }
        },        
        {
            $unwind: { path: "$first_transaction.chat_id", preserveNullAndEmptyArrays: true }
        },
        { '$lookup' : 
            {
                localField: "first_transaction.call_id",
                foreignField: "_id",
                from: "calldetails",
                as: "first_transaction.call_id"
            } 
        },
        { $unwind: { path: "$first_transaction.call_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "first_transaction.report_id",
                foreignField: "_id",
                from: "reports",
                as: "first_transaction.report_id"
            } 
        },
        { $unwind: { path: "$first_transaction.report_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "first_transaction.service_req_id",
                foreignField: "_id",
                from: "servicerequests",
                as: "first_transaction.service_req_id",

            } 
        },
        { $unwind: { path: "$first_transaction.service_req_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "first_transaction.service_req_id.service_id",
                foreignField: "_id",
                from: "services",
                as: "first_transaction.service_req_id.service_id",

            } 
        },
        { $unwind: { path: "$first_transaction.service_req_id.service_id", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "first_transaction.product_order_id",
                foreignField: "_id",
                from: "productorders",
                as: "first_transaction.product_order_id"
            } 
        },
        { $unwind: { path: "$first_transaction.product_order_id", preserveNullAndEmptyArrays: true }},
        { $unwind: { path: "$first_transaction.product_order_id.products", preserveNullAndEmptyArrays: true }},
        { '$lookup' : 
            {
                localField: "first_transaction.product_order_id.products.product_id",
                foreignField: "_id",
                from: "products",
                as: "first_transaction.product_order_id.products.product_id"
            } 
        },
        { $unwind: { path: "$first_transaction.product_order_id.products.product_id", preserveNullAndEmptyArrays: true }}, 
        { "$group": 
            { _id: "$_id",
                "products": { "$push": "$first_transaction.product_order_id.products" },
                data: { $first: "$$ROOT" }
            }
        },
        {
            $project: {
                "_id": 1,
                "products": { "$cond":[{ "$eq": ["$data.first_transaction.transaction_type", "product"] }, "$products", null] },
                "referror_id": "$data.referror_id",
                "used_by_id": "$data.used_by_id",
                "referral_code": "$data.referral_code",
                "first_transaction": "$data.first_transaction",
            }
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

module.exports.addReferrals = async(referror, used_by)=>{
    let refer = new referral({
        referror_id: referror._id,
        used_by_id: used_by._id,
        referral_code: referror.referral_code
    })
    
    refer.save((error, data) => {
        console.log('getReferrals error --- ', error, data);

        if (error) {
            
        }
    })
}

module.exports.getPayReferrors = async(/*referror, used_by*/)=>{
    console.log('getPayReferrors data --- ');

    let data = await referral.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "referror_id",
                foreignField: "_id",
                as: "referror_id"
            }
        },
        {
            $unwind: { path: "$referror_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "used_by_id",
                foreignField: "_id",
                as: "used_by_id"
            }
        },
        {
            $unwind: { path: "$used_by_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "transactions",
                localField: "first_transaction",
                foreignField: "_id",
                as: "first_transaction"
            }
        },
        {
            $unwind: { path: "$first_transaction", preserveNullAndEmptyArrays: true }
        },
        { 
            $group: {
                _id: "$referror_id",
                refer_count: { $sum: 1 },
                total_amount: { $sum: "$first_transaction.transaction_amt" },
                client_total_amount: { $sum: "$first_transaction.client_transaction_amt" },
                data: { $first: "$$ROOT" }
            }
        },
        {
            $project: {
                "_id": 1,
                refer_count: 1,
                total_amount: { $round: [ "$total_amount", 2 ]},
                client_total_amount: { $round: [ "$client_total_amount", 2 ]},
                referror_id: "$data.referror_id",
                used_by_id: "$data.used_by_id",
                first_transaction: "$data.first_transaction",
                referral_code: "$data.referral_code"
            }
        }
    ])

    console.log('getPayReferrors data --- ', data);

    return data
}