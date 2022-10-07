var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    from_id: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    description: String,
    category: String,
    support_status: {
        type: String,
        enum: ['Raised', 'Resolved']
    },
    support_id: String
},
{
    timestamps: true
});

const support = module.exports = mongoose.model('support', schema);

module.exports.getSupportById = async(req, cb)=>{
    console.log('getSupportById req.body ', req.body.ticket_id)

    let data = await support.findOne({ _id: req.body.ticket_id })
    .then( result=> result)

    console.log('getSupportById data ', data)

    return data
}

module.exports.getSupportsCount = async(req, cb)=>{
    var query = {}
    if (req.user.user_type == 'consumer' || req.user.user_type == 'astrologer') {
        query = { from_id: req.user._id, support_status: "Raised" }
    }

    let data = await support.countDocuments(query).then( result=> result)

    return data
}

module.exports.getSupports = async(req, cb)=>{
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 5
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    console.log('getSupports data ', req.user)

    var query = {}
    if (req.user.user_type == 'consumer' || req.user.user_type == 'astrologer') {
        query = { from_id: req.user._id }
    }

    let data = await support.aggregate([
        {
            $match: query
        },
        {
            $lookup: {
                from: "users",
                localField: "from_id",
                foreignField: "_id",
                as: "from_id"
            }
        },
        {
            $unwind: { path: "$from_id", preserveNullAndEmptyArrays: true }
        },
        { $sort: { createdAt: -1 } },
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