var mongoose = require('mongoose');
let schema = mongoose.Schema({
    name: String,
    content: String,
}, {
    timestamps: true
})
const astrocontent = module.exports = mongoose.model('astrocontent', schema);

module.exports.add = async (req) => {
    let content = new astrocontent(req.body);
    let saved = await content.save().then(result => result)
    return saved


}
module.exports.findByName = async (query) => {
    let data = await astrocontent.findOne(query).then((result) => result)
    return data
}
