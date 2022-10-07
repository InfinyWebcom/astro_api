var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    tip_date: Date,
    tip: [{
        sign: {
            type: mongoose.SchemaTypes.ObjectId,
            ref: 'astrosign'
        },
        description: String,
    }]
},
{
    timestamps: true
});

const tipoftheday = module.exports = mongoose.model('tipoftheday', schema);

module.exports.getTip = (req, cb)=>{
    tipoftheday.findOne({ tip_date: new Date(req.tip_date) })
    .populate('tip.sign')
    .exec((error, tipData) => {
        console.log('getTip error -- ', error, tipData);

        if (error) {
            return cb(true, undefined)
        }
        return cb(false, tipData)
    })
}

module.exports.getUserTip = async (req, cb)=>{

    let todayStr = new Date().toISOString().slice(0, 10)
    console.log('getUserTip --', new Date(todayStr))

    let data = await  tipoftheday.aggregate([    
        { $match: { tip_date: new Date(todayStr) } },
        { $unwind: "$tip" },
        { $match: { "tip.sign" : ObjectId(req.user.astro_sign) } },
        {
            $project: {
                _id: 1,
                tip_date: 1,
                sign: "$tip.sign",
                description: "$tip.description",
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])
    console.log('getUserTip data--', data)
    
    return data
}


module.exports.getAllTip = (req, cb)=>{
    console.log('getAllTip req --', req);

    var query = {}
    if (req.month && req.year) {
        var month = parseInt(req.month)
        var year = parseInt(req.year)

        var lastDay = new Date(year, month + 1, 1);
        var firstDay = new Date(year, month, 1);
        
        console.log('getAllTip firstDay --', firstDay, '----', lastDay);

        query = { tip_date: { $gte: firstDay, $lte: lastDay} }
    }
    
    tipoftheday.find(query)
    .populate('tip.sign')
    .exec((error, tipData) => {
        console.log('getAllTip error -- ', error, tipData);

        if (error) {
            return cb(true, error)
        }
        return cb(false, tipData)
    })
}

module.exports.addTip = (req, cb)=>{
    tipoftheday.findOne({ tip_date: new Date(req.body.tip_date) })
    .exec((error, tipData) => {
        console.log('savedTip tipData save err ', error, tipData);
        
        var newTip = new tipoftheday({
            tip_date: new Date(req.body.tip_date),
            tip: req.body.tip
        })
        if (tipData) {
            newTip = {}
            tipData.tip = req.body.tip

            newTip = tipData

            if (req.body.tip.length == 0) {
                tipoftheday.deleteOne({ tip_date: new Date(req.body.tip_date) }, function (err) {
                    if(err) console.log(err);
                    console.log("Successful deletion");
                });
                return cb(false, [])
            }
        }
        if (req.body.tip.length == 0) {
            return cb(false, [])
        }
        newTip.save((err, savedTip) => {
            console.log('savedTip save err ', err);
    
            if (err) {
                return cb(true, error)
            }
            return cb(false, savedTip)
        })       
    })
}