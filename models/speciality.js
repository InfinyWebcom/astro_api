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

const speciality = module.exports = mongoose.model('speciality', schema);

module.exports.getSpecialities = async(cb)=>{
    let data = await speciality.find({}).then( result=> result)

    return data
}