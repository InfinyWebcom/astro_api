var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    banner_image: {
        type: String,
    }
},
    {
        timestamps: true
    });

const banner = module.exports = mongoose.model('banner', schema);