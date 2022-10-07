var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/* NODE-MODULES */
var ObjectId = mongoose.Types.ObjectId;
var moment = require('moment-timezone');
const helper = require('../lib/helper');

var schema = new Schema({
  schedule_name: String,
  chat_id: {
    type: Schema.Types.ObjectId,
    ref: 'chat'
  },
  call_id: {
    type: Schema.Types.ObjectId,
    ref: 'calldetail'
  },
  service_req_id: {
    type: Schema.Types.ObjectId,
    ref: 'serviceRequest'
  },
  schedule_type: String,
  start_date: Date
},
  {
    timestamps: true
  });

const chatSession = module.exports = mongoose.model('chatSession', schema);

module.exports.getChatSessions = async (req, cb) => {
  console.log('getChatSessions req --- ', req);

  let data = await chatSession.find({})
    .populate('chat_id')
    .populate({
      path: 'chat_id',
      populate: {
        path: 'astrologer_id'
      }
    })
    .populate({
      path: 'chat_id',
      populate: {
        path: 'consumer_id'
      }
    })
    .then(result => result)

  console.log('getChatSessions data --- ', data);

  return data
}

module.exports.getSessionByChatId = async (chatData, cb) => {
  console.log('getSessionByChatId req --- ', chatData);

  let data = await chatSession.find({ chat_id: chatData._id })
    .populate('chat_id')
    .populate({
      path: 'chat_id',
      populate: {
        path: 'astrologer_id'
      }
    })
    .populate({
      path: 'chat_id',
      populate: {
        path: 'consumer_id'
      }
    })
    .then(result => result)

  console.log('getSessionByChatId data --- ', data);

  return data
}

module.exports.getSessionByType = async (chatData, schedule_type, cb) => {
  console.log('getSessionByChatId req --- ', chatData);

  let data = await chatSession.findOne({ chat_id: chatData._id, schedule_type: schedule_type })
    .populate('chat_id')
    .populate({
      path: 'chat_id',
      populate: {
        path: 'astrologer_id'
      }
    })
    .populate({
      path: 'chat_id',
      populate: {
        path: 'consumer_id'
      }
    })
    .then(result => result)

  console.log('getSessionByChatId data --- ', data);

  return data
}

module.exports.getNotifyServicePayments = async (req, cb) => {
  console.log('getChatSessions req --- ', req);

  let data = await chatSession.find({})
    .populate('service_req_id')
    .populate({
      path: 'service_req_id',
      populate: {
        path: 'astrologer_id'
      }
    })
    .populate({
      path: 'service_req_id',
      populate: {
        path: 'consumer_id'
      }
    })
    .then(result => result)

  console.log('getNotifyServicePayments data --- ', data);

  return data
}

module.exports.getSessionByServiceReqId = async (serviceReqData, cb) => {

  let data = await chatSession.find({ service_req_id: serviceReqData._id })
    .populate('service_req_id')
    .populate({
      path: 'service_req_id',
      populate: {
        path: 'astrologer_id'
      }
    })
    .populate({
      path: 'service_req_id',
      populate: {
        path: 'consumer_id'
      }
    })
    .then(result => result)

  console.log('getSessionByServiceReqId data --- ', data);

  return data
}