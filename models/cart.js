var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    user_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },         
    cart_details: [{
        product_id: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'product'
        },
        quantity: Number,
    }]
}, {
    timestamps: true
});

const cart = module.exports = mongoose.model('cart', schema);

module.exports.getCart = async(req, cb)=>{
    console.log('getCart req---', req)

    let data = await cart.findOne({ user_id: req._id })
    .populate('cart_details.product_id')
    .then( result=> result)

    return data
}

module.exports.getCartData = async(req, cb)=>{
    console.log('getCart req---', req)

    let data = await cart.aggregate([
        { $match : { "user_id" : ObjectId(req.user._id) } },
        { $lookup: {
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
                $unwind: { path: "$cart_details" }
            },
            { $lookup: {
                    from: "products",
                    localField: "cart_details.product_id",
                    foreignField: "_id",
                    as: "cart_details.product_id"
              }
        },
        {
                $unwind: { path: "$cart_details.product_id", preserveNullAndEmptyArrays: true }
            },
           { $group: {
                 _id: "$user_id._id",
                data: { $first: "$$ROOT" },
                cart_details: { 
                    $push:  "$cart_details"
                    
                }
            }
        },
        {
            $project: {
                _id: "$data._id",
                user_id: "$data.user_id",
                cart_details: "$cart_details",
                createdAt: "$data.createdAt",
                updatedAt: "$data.updatedAt"
             }
        }
    ])    

    return data
}
