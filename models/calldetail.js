var mongoose = require('mongoose');
var Schema = mongoose.Schema;

/* NODE-MODULES */
var ObjectId = mongoose.Types.ObjectId;
var moment = require('moment-timezone');
const helper = require('../lib/helper');

var schema = new Schema({
    schedule_name: String,//room name        
    start_date: Date,
    end_date: Date,
    room_sid: String,
    room_status: {
        type: String,
        default: 'no_status'    //declined, missed by astrologer, success
    },
    consumer_id: {    //consumer
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    astrologer_id: {   //astrologer
        type: Schema.Types.ObjectId,
        ref: 'user'
    },
    consumer_status: {
        type: String,
        default: 'no_status'
    },
    astrologer_status: {
        type: String,
        default: 'no_status'
    },
    consumer_name: {
        type: String,
        default: 'no_name'
    },
    astrologer_name: {
        type: String,
        default: 'no_name'
    },
    consumer_call_id: {
        type: String,
        default: 'no call_id'
    },
    astrologer_call_id: {
        type: String,
        default: 'no call_id'
    },
    consumer_duration: {
        type: Number,
        default: 0
    },
    astrologer_duration: {
        type: Number,
        default: 0
    },
    cancelled_by: {
        type: String,
        default: 'none'
    },
    call_audio_video: {
        type: String,
        enum: ['audio', 'video'],
        required: false
    },
    call_started: {
        type: Boolean,
        default: false
    },
    call_rate: {
        type: Number,
        default: 0
    },
    client_call_rate: {
        type: Number,
        default: 0
    },
    unique_call_id: String,
    call_uuid: String,
},
{
    timestamps: true
});

const callDetailModel = module.exports = mongoose.model('calldetail', schema);

module.exports.getCallsCount = async(req, cb)=>{
    var query = { call_audio_video : req.body.call_audio_video }
    if (req.body.astrologer_id && req.body.astrologer_id != "") {
        query = { call_audio_video : req.body.call_audio_video, astrologer_id : req.body.astrologer_id }
    }
    if (req.body.consumer_id && req.body.consumer_id != "") {
        query = { call_audio_video : req.body.call_audio_video, consumer_id : req.body.consumer_id }
    }

    let data = await callDetailModel.countDocuments(query).then( result=> result)

    return data
}

module.exports.getOngoingCall = async(req, cb)=>{
    var query = {
        $and: [
            { 'astrologer_id': req.body.astrologer_id },
            { 'call_started': true }
        ]
    }

    let data = await callDetailModel.findOne(query)
    .populate('astrologer_id')
    .populate('consumer_id')
    .then( result=> result)

    return data
}

module.exports.getCallByQuery = async(query, cb)=>{
    let data = await callDetailModel.findOne(query)
    .then(result=>result)

    console.log('getCallByQuery data --- ', data);
    
    return data
}

module.exports.getCallByRoomId = (req, cb)=>{
    callDetailModel.aggregate([
        { $match: { "room_sid" : req.body.CallSid } },
        { $lookup: 
            {
                from: 'users',
                localField: 'consumer_id',
                foreignField: '_id',
                as: 'consumer_id'
            } 
        },
        {
            $unwind: { path: "$consumer_id", preserveNullAndEmptyArrays: true }
        },
        { $lookup: 
            {
                from: 'users',
                localField: 'astrologer_id',
                foreignField: '_id',
                as: 'astrologer_id'
            } 
        },
        {
            $unwind: { path: "$astrologer_id", preserveNullAndEmptyArrays: true }
        }
    ])
    .exec((error, data) => {
        console.log('getCallByRoomId error -- ', error, data);

        if (error || data.length == 0) {
            return cb(true, undefined)
        }
        return cb(false, data[0])
    })
}

module.exports.getCalls = async(req, cb)=>{
    
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page): 1
    var skipPage = (page - 1) * perPage;

    var search = req.body.searchText == undefined ? "" : req.body.searchText

    var query = { 'call_audio_video': req.body.call_audio_video }
    var matchQuery = { $match: { $or: [ { 'astrologer_id.first_name': { $regex: search, $options: 'i' } }, {'consumer_id.first_name': { $regex: search, $options: 'i' } }  ] } }

    if (req.body.consumer_id && req.body.consumer_id != "") {
        query = { 'call_audio_video': req.body.call_audio_video, 'consumer_id': ObjectId(req.body.consumer_id), $expr: { $ne : ["$room_status", "no_status"] } }
    }
    else if (req.body.astrologer_id && req.body.astrologer_id != "") {
        query = { 'call_audio_video': req.body.call_audio_video, 'astrologer_id': ObjectId(req.body.astrologer_id), $expr: { $ne : ["$room_status", "no_status"] } }
    }
    else if (req.user.user_type == "consumer") {
        query = { 'call_audio_video': req.body.call_audio_video, 'consumer_id': ObjectId(req.user._id), $expr: { $ne : ["$room_status", "no_status"] }}
        matchQuery = { $match: { 'astrologer_id.first_name': { $regex: search, $options: 'i' } } }
    }
    else if (req.user.user_type == "astrologer") {
        query = { 'call_audio_video': req.body.call_audio_video, 'astrologer_id': ObjectId(req.user._id) }
        matchQuery = { $match: {'consumer_id.first_name': { $regex: search, $options: 'i' } } }
    }

    //to get start and end date
    let date = new Date();
    let month = (req.body.month != undefined && req.body.month != '') ? parseInt(req.body.month) : date.getMonth() + 1
    let year = (req.body.year != undefined && req.body.year != '') ? parseInt(req.body.year) : date.getFullYear()
    
    var start = moment.tz(date, helper.getTimezone()).startOf('day').toDate()
    var end = moment.tz(date, helper.getTimezone()).endOf('day').toDate()

    console.log('getCalls start ', start, end);

    var monthMatchQuery = { $match: {} }
    if (req.body.type == "today") {
        monthMatchQuery = { $match: { updatedAt: { $gte: start, $lte: end } } }
    }
    if (req.body.type == "month") {
        monthMatchQuery = { $match: { month: month, year: year } }
    }

    var aggQuery = [];
    aggQuery.push(
        { $match: query },
        {
            $project : {
                year : {
                    $year : "$updatedAt"
                },
                month : {
                    $month : "$updatedAt"
                },
                schedule_name: 1,
                start_date: 1,
                end_date: 1,
                room_sid: 1,
                room_status: 1,
                consumer_id: 1,
                astrologer_id: 1,
                consumer_status: 1,
                astrologer_status: 1,
                consumer_name: 1,
                astrologer_name: 1,
                consumer_call_id: 1,
                astrologer_call_id: 1,
                consumer_duration: 1,
                astrologer_duration: 1,
                cancelled_by: 1,
                call_audio_video: 1,
                call_started: 1,
                call_rate: 1,
                client_call_rate: 1,
                updatedAt: 1,
                createdAt: 1
            }
        },
        monthMatchQuery,
        { "$sort": { "createdAt": -1 } },
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
                foreignField: "call_id",
                from: "ratings",
                as: "rating"
            }
        },
        {
            $unwind: { path: "$rating", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                localField: "consumer_id.astro_sign",
                foreignField: "_id",
                from: "astrosigns",
                as: "consumer_id.astro_sign"
            }
        },
        { $unwind: { path: "$consumer_id.astro_sign", preserveNullAndEmptyArrays: true } },
        matchQuery,
    )

    console.log('getCalls skipPage', skipPage, perPage);

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
    }
    else {
        aggQuery.push(
            {
                $facet: {
                    data: [{ "$match": { }}],
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

    let data = await callDetailModel
    .aggregate(aggQuery)

    return data
}

module.exports.getOngoingCallDetails = async(req, cb)=>{
    
    var query = {}

    if (req.user.user_type == "consumer") {
        query = { consumer_id: req.user._id, call_started: true }
    }
    if (req.user.user_type == "astrologer") {
        query = { astrologer_id: req.user._id, call_started: true }
    }

    let data = await callDetailModel.findOne(query)
    .populate('astrologer_id')
    .populate('consumer_id')
    .then( result=> result)

    return data
}