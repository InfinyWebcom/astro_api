const { query } = require('express-validator');
var mongoose = require('mongoose');
var schema = mongoose.Schema({
    name: String,
    image: String,
    content: String,
    is_deleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})
let Blog = module.exports = mongoose.model('blog', schema)

module.exports.add = async (body) => {
    let blog = new Blog(body);
    let data = await blog.save().then(result => result);
    return data
}
module.exports.updateData = async (query, body) => {
    let data = await Blog.findOneAndUpdate(query, { $set: body }, { new: true }).exec()
    return data
}
module.exports.findOneData = async (query) => {
    let data = await Blog.findOne(query).then(result => result)
    return data
}
module.exports.list = async (req) => {
    //for pagination
    let perPage = req.body.perPage ? parseInt(req.body.perPage) : 20
    let page = req.body.page ? parseInt(req.body.page) : 1
    let skipPage = (page - 1) * perPage;

    let query = []
    query.push({
        $match: {
            is_deleted: false
        }
    })
    query.push({ $sort: { createdAt: -1 } })
    query.push(
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
    let data = await Blog.aggregate(query).then(result => result)
    return data

}