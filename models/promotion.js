var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    description: String,
    user_type: {
        type: String,
        enum: ['astrologer', 'consumer', 'all']
    },
},
{
    timestamps: true
});

const promotion = module.exports = mongoose.model('promotions', schema);

module.exports.getPromoCount = async(req, cb)=>{
    var query = {}
    if (req.body.user_type && req.body.user_type != "") {
        query = { user_type: req.body.user_type }
    }

    let data = await promotion.countDocuments(query).then( result=> result)

    return data
}

module.exports.getPromotions = async(req, cb)=>{
    console.log('getPromtoions req --- ', req);

    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    var query = {}
    if (req.body.user_type && req.body.user_type != "") {
        query = { user_type: req.body.user_type }
    } 

    let data = await promotion.find(query)
    .sort({ createdAt: -1 })
    .skip(skipPage)
    .limit(perPage)
    .then(result=>result)

    console.log('getPromtoions data --- ', data);
    
    return data
}