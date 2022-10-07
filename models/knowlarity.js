var mongoose = require('mongoose');
var schema = mongoose.Schema({
    call_date: Date,
    call_time: String,
    consumer_number: String,
    agent_number: String,
    call_duration: String,
    transaction_id: String,
    call_uuid: String,
    extras: String
}, {
    timestamps: true
})
let Knowlarity = module.exports = mongoose.model('knowlarity', schema);

// call_date,call_time,consumer_number,agent_number,call_duration,transaction_id,call_uuid,extras