let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let schema = new Schema({
  sgst: {
    type: Number,
    default: 0
  },
  cgst: {
    type: Number,
    default: 0
  },
  other_charges: {
    type: Number,
    default: 0
  },
},
  {
    timestamps: true
  });

const systemConfig = module.exports = mongoose.model('systemConfig', schema);

module.exports.getAllSystemConfig = async (req, res) => {

  let data = await systemConfig.find({}).then(result => result)

  let ls = new systemConfig({})
  ls.save()

  return data
}
