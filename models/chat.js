var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/* NODE-MODULES */
var ObjectId = mongoose.Types.ObjectId;
var moment = require('moment-timezone');
const helper = require('../lib/helper');

var schema = new Schema({
    channel_name: String,
    astrologer_id: {
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    consumer_id: {
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    last_message: String,
    channel_id: String,
    astrologer_member_id: String,
    consumer_member_id: String,
    start_time: Date,
    end_time: Date,
    chat_duration: Number, //seconds
    chat_rate: {
        type: Number,
        default: 0
    },
    client_chat_rate: {
        type: Number,
        default: 0
    },
    request_status: {
        type: String,
        enum: ['Pending', 'Requested', 'Accepted', 'Declined', 'Completed', 'Missed', 'Cancelled', 'Cancelled_astrolger']
    },
    accepted_time: Date,
    end_reason: String //reason for chat end (astrologer ended chat, consumer ended chat, wallet balance is less, astrologer not accepted request, astrologer not replying for 10 min, astrologer not replying for 5 min, consumer not replying for 5 min)
},
{
    timestamps: true
});

const chat = module.exports = mongoose.model('chat', schema);

module.exports.getChatsCount = async(req, cb)=>{
    var query = { is_deleted: false }
    if (req.body.astrologer_id && req.body.astrologer_id != "") {
        query = { is_deleted: false, astrologer_id : req.body.astrologer_id }
    }
    if (req.body.consumer_id && req.body.consumer_id != "") {
        query = { is_deleted: false, consumer_id : req.body.consumer_id }
    }
    let data = await chat.countDocuments(query).then( result=> result)

    return data
}

module.exports.getChatById = async(req, cb)=>{
    console.log('getChatById req --- ', req.body);

    let data = await chat.findOne({ _id: req.body.chat_id })
    .populate('astrologer_id')
    .populate('consumer_id')
    .populate({
        path : 'astrologer_id',
        populate : {
            path : 'subscribed_users.consumer_id'
        }
    })
    .then(result=>result)

    console.log('getChatById data --- ', data);
    
    return data
}

module.exports.getChatByChannelId = async(req, cb)=>{
    console.log('getChatByChannelId req --- ', req.body);

    let data = await chat.findOne({ channel_id: req.body.ChannelSid })
    .populate('astrologer_id')
    .populate('consumer_id')
    .then(result=>result)

    console.log('getChatById data --- ', data);
    if (req.body.complated_that == "astrologer") {
        cb(data)
    }
    return data
}

module.exports.getChatByConsumerId = async(chatdata, cb)=>{
    console.log('getChatByConsumerId chatdata --- ', chatdata);

    let data = await chat.find({ consumer_id: chatdata.consumer_id._id, request_status: "Requested" })
    .populate('astrologer_id')
    .populate('consumer_id')
    .then(result=>result)

    console.log('getChatByConsumerId data --- ', data);
    
    cb(data)
}

module.exports.getChatByAstrologerId = async(chatdata, cb)=>{
    console.log('getChatByAstrologerId chatdata --- ', chatdata);

    let data = await chat.find({ astrologer_id: chatdata.astrologer_id._id, request_status: "Requested" })
    .populate('astrologer_id')
    .populate('consumer_id')
    .then(result=>result)

    console.log('getChatByAstrologerId data --- ', data);
    
    cb(data)
}

module.exports.getOngoingChat = async(req, cb)=>{
    console.log('getOngoingChat req --- ', req.body);

    var query = {}
    if (req.user.user_type == "consumer") {
        query = { consumer_id: req.user._id, request_status: "Accepted" }
        if (req.body.request_status == "Requested") {
            query = { consumer_id: req.user._id, request_status: "Requested" }

            let request_data = await chat.find(query)
            .populate('astrologer_id')
            .populate('consumer_id')
            .then(result=>result)

            console.log('getOngoingChat request_data --- ', request_data);
            
            return request_data
        }
    }
    if (req.user.user_type == "astrologer") {
        query = { astrologer_id: req.user._id, request_status: "Accepted" }
    }
    
    let data = await chat.findOne(query)
    .populate('astrologer_id')
    .populate('consumer_id')
    .sort({ createdAt: -1 })
    .then(result=>result)

    console.log('getOngoingChat data --- ', data);
    
    return data
}

module.exports.getChats = async(req, cb)=>{
    console.log('getChats req ', req.body);
    
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    var query = {}
    var searchQuery = {}
    var searchText = (req.body.searchText == "" || req.body.searchText == undefined) ? '' : req.body.searchText;
    
    if (req.body.consumer_id && req.body.consumer_id != "") {
        query = { consumer_id: ObjectId(req.body.consumer_id) }
    }
    else if (req.body.astrologer_id && req.body.astrologer_id != "") {
        query = { astrologer_id: ObjectId(req.body.astrologer_id) }
    }
    if (req.user.user_type == "consumer") {
        query = { 'consumer_id': ObjectId(req.user._id) }
        searchQuery = { 'astrologer_id.first_name': { $regex: searchText, $options: 'i' } }
    }
    if (req.user.user_type == "astrologer") {
        query = { 'astrologer_id': ObjectId(req.user._id) }
        searchQuery = { 'consumer_id.first_name': { $regex: searchText, $options: 'i' } }
    }

    //to get start and end date
    let date = new Date();

    var dateThree = new Date();
//    dateThree.setHours(dateThree.getHours() - 3);
    dateThree.setHours(dateThree.getMinutes() - 5);

    console.log('getChats dateThree ', dateThree);

    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()
    
    var start = moment.tz(date, helper.getTimezone()).startOf('day').toDate()
    var end = moment.tz(date, helper.getTimezone()).endOf('day').toDate()

    console.log('getChats start ', start, end, date);

    var monthMatchQuery = { $match: {} }
    if (req.body.type == "today") {
        monthMatchQuery = { $match: { createdAt: { $gte: start, $lte: end } } }
    }
    if (req.body.type == "month") {
        monthMatchQuery = { $match: { month: month, year: year } }
    }

    let aggQuery = [];
    aggQuery.push(
        { $match: query },
        {
            $project : {
                year : {
                    $year : "$createdAt"
                },
                month : {
                    $month : "$createdAt"
                },
                createdAt: 1,
                updatedAt: 1,
                channel_name: 1,
                astrologer_id: 1,
                consumer_id: 1,
                is_deleted: 1,
                last_message: 1,
                channel_id: 1,
                start_time: 1,
                end_time: 1,
                chat_duration: 1,
                chat_rate: 1,
                client_chat_rate: 1,
                request_status: 1,
                is_requested: { "$cond":[{ "$eq": ["$request_status", "Requested"] }, 1, 0] }
                /*
                request_status: {
                    $cond: {
                       if: { $lte: [ "$createdAt", dateThree ] },
                       then: "Missed",
                       else: "$request_status"
                    }
                }*/
            }
        },
        monthMatchQuery,
        { "$sort": { "createdAt": -1, "is_requested": -1 } },
        {
            $lookup: {
                localField: "astrologer_id",
                foreignField: "_id",
                from: "users",
                as: "astrologer_id"
            }
        },
        { $unwind: "$astrologer_id" },
        {
            $lookup: {
                localField: "consumer_id",
                foreignField: "_id",
                from: "users",
                as: "consumer_id"
            }
        },
        { $unwind: "$consumer_id" },
        {
            $lookup: {
                localField: "_id",
                foreignField: "chat_id",
                from: "ratings",
                as: "rating"
            }
        },
        {
            $unwind: { path: "$rating", preserveNullAndEmptyArrays: true }
        },
        
    //    { $match: searchQuery }
    )

    if (req.body.request_status == "Requested") {
        aggQuery.push(
            { 
                $match: { request_status: "Requested" } 
            }
        )
    }
    else {
        if (req.body.type == "today") {
            aggQuery.push(
                { 
                    $match: { $and: [ {request_status: { $ne: "Accepted" } }, { request_status: { $ne: "Pending" } } ] }
                }
            )
        }
        else {
            aggQuery.push(
                { 
                    $match: { $and: [ { request_status: { $ne: "Requested" } }, { request_status: { $ne: "Accepted" } }, { request_status: { $ne: "Pending" } } ] }
                }
            )
        }
    }
    
    if (req.user.user_type == "consumer" || req.user.user_type == "astrologer") {
        aggQuery.push(
            {
                $facet: {
                    data: [{ $skip: skipPage }, { $limit: perPage }],
                    totalCount: [
                        {
                            $count: 'count'
                        }
                    ]
                }
            }
        )
    } else {
        aggQuery.push(
            {
                $facet: {
                    data: [ { "$match": { }} ],
                    totalCount: [
                        {
                            $count: 'count'
                        }
                    ]
                }
            }           
        )
    }
    aggQuery.push(
        { $unwind: "$totalCount" },
        { 
            $project: {
                data: 1,
                totalCount: "$totalCount.count"
            }
        }
    )

    let data = await chat
    .aggregate(aggQuery)

    console.log('getChats data --- ', data[0]);

    return data
}

module.exports.getMissedChats = async(req, cb)=>{
    var dateThree = new Date();
    dateThree.setHours(dateThree.getHours() - 3);

    let aggQuery = [];
    aggQuery.push(
        { 
            $match: { request_status: "Requested" } 
        },
        {
            $project : {
                year : {
                    $year : "$createdAt"
                },
                month : {
                    $month : "$createdAt"
                },
                createdAt: 1,
                updatedAt: 1,
                channel_name: 1,
                astrologer_id: 1,
                consumer_id: 1,
                is_deleted: 1,
                last_message: 1,
                channel_id: 1,
                start_time: 1,
                end_time: 1,
                chat_duration: 1,
                chat_rate: 1,
                client_chat_rate: 1,
                request_status: 1
            }
        },
        {
            $lookup: {
                localField: "astrologer_id",
                foreignField: "_id",
                from: "users",
                as: "astrologer_id"
            }
        },
        { $unwind: "$astrologer_id" },
        {
            $lookup: {
                localField: "consumer_id",
                foreignField: "_id",
                from: "users",
                as: "consumer_id"
            }
        },
        { $unwind: "$consumer_id" }
    )

    let data = await chat
    .aggregate(aggQuery)

    console.log('getMissedChats data --- ', data);

    return data
}