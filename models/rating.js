var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    from_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    to_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    rating_value: Number,
    description: String,
    is_deleted: {
        type: Boolean,
        default: false
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
    service_req_id: {
        type: Schema.Types.ObjectId,
        ref: 'serviceRequest'
    },
    pay_order_id: String, //razor pay order id
    pay_receipt: String, //razor pay receipt
    pay_payment_id: String,  //razor pay payment id
    rating_type: {
        type: String,
        enum: ['chat', 'report', 'audio', 'video', 'service']
    }
}, {
    timestamps: true
});

const rating = module.exports = mongoose.model('rating', schema);

module.exports.getRatings = async(req, cb)=>{
    
    //for pagination
    var perPage = req.perPage ? parseInt(req.perPage) : 10
    var page = req.page ? parseInt(req.page): 1
    var skipPage = (page - 1) * perPage;

    console.log('getRatings req ', req);

    let data = await rating.find({ to_id: req.user_id, is_deleted: false })
    .populate('from_id')
    .populate('to_id')
    .populate('chat_id')
    .populate('call_id')
    .populate('report_id')
    .populate('service_req_id')
    .populate('service_req_id.service_id')
    .limit(perPage)
    .skip(skipPage)
    .sort({ createdAt: -1 })
    .then( result=> result)

    console.log('getRatings data ', data);
    return data
}

module.exports.getRatingsCount = async(req, cb)=>{
    let data = await rating.countDocuments({ to_id: req.user_id, is_deleted: false }).then( result=> result)

    return data
}

module.exports.getRatingById = async(req, cb)=>{
    let data = await rating.findOne({ _id: req.body.rating_id })
    .then(result=>result)

    console.log('getRatingById data --- ', data);
    
    return data
}

module.exports.getRatingByQuery = async(query, cb)=>{
    let data = await rating.findOne(query)
    .then(result=>result)

    console.log('getRatingByQuery data --- ', data);
    
    return data
}

module.exports.getRatingByRazorId = async(req, cb)=>{
    console.log('getRatingByRazorId req --- ', req);

    let data = await rating.findOne(req)
    .populate('from_id')
    .populate('to_id')
    .populate('chat_id')
    .populate('call_id')
    .populate('report_id')
    .populate('service_req_id')
    .then(result=>result)
    
    return data
}