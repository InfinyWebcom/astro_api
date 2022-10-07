var mongoose = require('mongoose')

var schema = mongoose.Schema({
    name: String
}, {
    timestamps: true
})

const supportCategory = module.exports = mongoose.model('supportCategory', schema)

module.exports.getCategories = async(req, cb)=>{
    console.log('getCategories req.body ', req.body)

    let data = await supportCategory.find({ })
    .then( result=> result)

    console.log('getCategories data ', data)

    return data
}