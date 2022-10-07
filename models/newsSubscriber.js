var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    email: {
        type: String,
        required: false
    },
},
{
    timestamps: true
});

const news = module.exports = mongoose.model('newsSubscriber', schema);

module.exports.getNewsSubscribers = async(req, cb)=>{
    let data = await news.findOne({ email: req.body.email }).then( result=> result)

    return data
}