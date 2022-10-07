var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    name: {
        type: String,
        required: false
    },
},
{
    timestamps: true
});

const language = module.exports = mongoose.model('language', schema);

module.exports.getLanguages = async(cb)=>{
    let data = await language.find({ }).then( result=> result)

    return data
}
