var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    message: String,
    from_id: {
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    to_id: {
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    chat_id: {
        type: Schema.Types.ObjectId,
        ref: 'chat'
    },
    channel_id: String,
    message_type: {
        type: String,
        enum: ['url', 'text', 'image', 'video', 'pdf']
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    mediaSid: String,
    media_url: String
},
{
    timestamps: true
});

const message = module.exports = mongoose.model('message', schema);

module.exports.getMessages = async(req, cb)=>{
    console.log('getChatById req --- ', req.body);

    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    let data = await message.find({ chat_id: req.body.chat_id })
    .populate('chat_id')
    .populate({
        path : 'chat_id',
        populate : {
          path : 'astrologer_id'
        }
    })
    .populate({
        path : 'chat_id',
        populate : {
          path : 'consumer_id'
        }
    })
    .sort({ createdAt: 1 })
//    .skip(skipPage)
//    .limit(perPage)
    .then(result=>result)

    console.log('getChatById data --- ', data);
    
    return data
}

module.exports.getLastChannelMessage = async(chatData, lastTime, cb)=>{    
    var dateFive = new Date();
    dateFive.setMinutes(dateFive.getMinutes() - lastTime);

    console.log('getLastChannelMessage chatData --- ', chatData);
    console.log('getLastChannelMessage dateFive --- ', dateFive);

    let data = await message.findOne({ chat_id: chatData._id })
    .populate('chat_id')
    .populate({
        path : 'chat_id',
        populate : {
          path : 'astrologer_id'
        }
    })
    .populate({
        path : 'chat_id',
        populate : {
          path : 'consumer_id'
        }
    })
    .sort({ createdAt: -1 })
    .then(result=>result)

    console.log('getLastChannelMessage data --- ', data);

    cb(data)
}

module.exports.getLastConsumerMessage = async(chatData, lastTime, cb)=>{    
    var dateFive = new Date();
    dateFive.setMinutes(dateFive.getMinutes() - lastTime);

    console.log('getLastConsumerMessage chatData --- ', chatData);
    console.log('getLastConsumerMessage dateFive --- ', dateFive);

    let data = await message.findOne({ chat_id: chatData._id, from_id: chatData.consumer_id._id })
    .populate('chat_id')
    .populate({
        path : 'chat_id',
        populate : {
          path : 'astrologer_id'
        }
    })
    .populate({
        path : 'chat_id',
        populate : {
          path : 'consumer_id'
        }
    })
    .sort({ createdAt: -1 })
    .then(result=>result)

    console.log('getLastConsumerMessage data --- ', data);

    cb(data)
}

module.exports.getLastAstrologerMessage = async(chatData, lastTime, cb)=>{    
    var dateFive = new Date();
    dateFive.setMinutes(dateFive.getMinutes() - lastTime);

    console.log('getLastAstrologerMessage chatData --- ', chatData);
    console.log('getLastAstrologerMessage dateFive --- ', dateFive);

    let data = await message.findOne({ chat_id: chatData._id, from_id: chatData.astrologer_id._id })
    .populate('chat_id')
    .populate({
        path : 'chat_id',
        populate : {
          path : 'astrologer_id'
        }
    })
    .populate({
        path : 'chat_id',
        populate : {
          path : 'consumer_id'
        }
    })
    .sort({ createdAt: -1 })
    .then(result=>result)

    console.log('getLastAstrologerMessage data --- ', data);

    cb(data)
}

module.exports.getLastConsumerMessageNew = async(chatData, lastTime, cb)=>{    
    var dateFive = new Date();
    dateFive.setMinutes(dateFive.getMinutes() - lastTime);

    console.log('getLastConsumerMessageNew chatData --- ', chatData);
    console.log('getLastConsumerMessageNew dateFive --- ', dateFive);

    let data = await message.findOne({ chat_id: chatData._id, from_id: chatData.consumer_id._id })
    .populate('chat_id')
    .populate({
        path : 'chat_id',
        populate : {
          path : 'astrologer_id'
        }
    })
    .populate({
        path : 'chat_id',
        populate : {
          path : 'consumer_id'
        }
    })
    .sort({ createdAt: -1 })
    .then(result=>result)

    console.log('getLastConsumerMessageNew data --- ', data);

 //   console.log('getLastConsumerMessageNew accepted_time --- ', data.chat_id.accepted_time);
    var currentDate = new Date()
    console.log('getLastConsumerMessageNew currentDate --- ', currentDate);
//    console.log('getLastConsumerMessageNew createdAt --- ', data.createdAt);
    if (data) {
        if (dateFive >= data.chat_id.accepted_time && data.createdAt < dateFive) {
            console.log('getLastConsumerMessageNew null --- ');
            return cb(null)
        } 
        else {
            console.log('getLastConsumerMessageNew else not null --- ');
            return cb(data)
        }
    }
    else {
        console.log('getLastConsumerMessageNew not null --- ');
        return cb(data)
    }
}

module.exports.getLastAstrologerMessageNew = async(chatData, lastTime, cb)=>{    
    var dateFive = new Date();
    dateFive.setMinutes(dateFive.getMinutes() - lastTime);

    console.log('getLastAstrologerMessageNew chatData --- ', chatData);
    console.log('getLastAstrologerMessageNew dateFive --- ', dateFive);

    let data = await message.findOne({ chat_id: chatData._id, from_id: chatData.astrologer_id._id, createdAt: { $gte: dateFive } })
    .populate('chat_id')
    .populate({
        path : 'chat_id',
        populate : {
          path : 'astrologer_id'
        }
    })
    .populate({
        path : 'chat_id',
        populate : {
          path : 'consumer_id'
        }
    })
    .sort({ createdAt: -1 })
    .then(result=>result)

    console.log('getLastAstrologerMessageNew data --- ', data);

    cb(data)
}
