var mongoose = require('mongoose');
var Schema = mongoose.Schema;

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

const service = module.exports = mongoose.model('service', schema);

module.exports.getServices = async(req, cb)=>{
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    let data = await service.find({ is_deleted: false })
    .limit(perPage)
    .skip(skipPage)
    .then( result=> result)

    return data
}

module.exports.getServicesCount = async(req, cb)=>{
    let data = await service.countDocuments({ is_deleted: false })
    .then( result=> result)

    return data
}

module.exports.getServiceById = async(req, cb)=>{
    console.log('getServiceById req --- ', req);

    let data = await service.findOne({ _id: req.service_id }).then(result=>result)

    console.log('getServiceById data --- ', data);
    
    return data
}

module.exports.getProductsServices = async(req, cb)=>{
    console.log('getProductsServices req --- ', req);

    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    var searchQuery = (req.body.searchText && req.body.searchText != "") ? { 'name': { $regex: req.body.searchText, $options: 'i' } } : { }

    var matchQuery = (req.body.collection_type && req.body.collection_type != "") ? { collection_type: req.body.collection_type } : { }

    let data = await service.aggregate( // 1. Use any collection containing at least one document.
    [
        { $limit: 1 }, // 2. Keep only one document of the collection.
        { $project: { _id: '$$REMOVE' } }, // 3. Remove everything from the document.

        // 4. Lookup collections to union together.
        { $lookup: { from: 'products', pipeline: [{ $match: { is_deleted: false } }, { $addFields: { collection_type: "product" } }], as: 'products' } },
        { $lookup: { from: 'services', pipeline: [{ $match: { is_deleted: false } }, { $addFields: { collection_type: "service" } }], as: 'services' } },

        // 5. Union the collections together with a projection.
        { $project: 
            { 
                union: { $concatArrays: ["$products", "$services"] }
            } 
        },
        // 6. Unwind and replace root so you end up with a result set.
        { $unwind: '$union' },
        { $replaceRoot: { newRoot: '$union' } },
        { $match: matchQuery },
        { $match: searchQuery },
        { "$sort": { "createdAt": -1 } },
        { $skip: skipPage },
        { $limit: perPage }
    ]);

    console.log('getProductsServices data --- ', data);
    
    return data
}

module.exports.getServiceList = async(req, cb)=>{
  
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

    let data = await service.aggregate([
        matchQuery,
        { $sort: { name: 1 } },
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