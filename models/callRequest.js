var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    name: String,
    email: String,
    mobile: String,
    preferred_time: {
        type: Date,
        required: false
    },
    call_time: {
        type: Date,
        required: false
    },
    request_status: {
        type: String,
        enum: ['Requested', 'Scheduled', 'Completed', 'Settled']
    },
    astrologer_id: {   //astrologer
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    call_duration: Number,
    call_rate: Number
},
{
    timestamps: true
});

const callRequest = module.exports = mongoose.model('callRequest', schema);

module.exports.getCallRequestById = async(req, cb)=>{
    let data = await callRequest.findOne({ _id: req.body.request_id })
    .sort({ name: 1 })
    .then( result=> result)

    console.log('getCallRequestById data--- ', data);

    return data
}

module.exports.getCallRequests = async(req, cb)=>{
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    var query = {}
    if (req.body.request_status && req.body.request_status != '') {
        query = { request_status : req.body.request_status }
    }

    let data = await callRequest.aggregate([
        {
            $match: query
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