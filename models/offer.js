const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = mongoose.Types.ObjectId;

const schema = new Schema({
    name: String,
    isActive: Boolean,
    type: String
},
{
    timestamps: true
});

const Offer = module.exports = mongoose.model('offer', schema);