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

const astrosign = module.exports = mongoose.model('astrosign', schema);

module.exports.getAstroSigns = async(cb)=>{
    let data = await astrosign.find({ })
    .sort({ name: 1 })
    .then( result=> result)

    return data
}

module.exports.getAstroSignByQuery = async(query, cb)=>{
    let data = await astrosign.findOne(query)
    .then( result=> result)

    return data
}

module.exports.addSign = (req, cb)=>{

    var newSign = new astrosign({
        name: req.body.name
    })
    newSign.save((err, savedSign) => {
        console.log('savedSign userData save err ', err);

        if (err) {
            cb(true, undefined)
        }
        cb(false, savedSign)
    })
}