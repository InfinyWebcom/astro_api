var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    first_name: {
        type: String,
        required: false
    },
    last_name: {
        type: String,
        required: false
    },
    info: {
        type: String,
        required: false
    },
    user_type: {
        type: String,
        enum: ['astrologer', 'consumer', 'admin', 'referror'],
        required: true
    },
    unique_name: {      //random string for voice call
        type: String,
        required: false
    },
    email: {
        type: String,
        required: false
    },
    mobile: {
        type: String,
        required: false
    },
    password: {
        type: String,
        required: false
    },
    profile_url: {
        type: String,
        required: false
    },
    groupId: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'permissionGroup'
    },
    device_token: {
        type: Array,
        "default": []
    },
    otp: {      //forgot password otp
        type: String,
        required: false
    },
    otp_expired: Date,
    wallet_balance: {    //consumer wallet
        type: Number,
        default: 0
    },
    languages_spoken: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'language'
    }],
    specialities: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'speciality'
    }],
    certifications: [{
        title: String,
        cert_date: Date,
        certificate: String
    }],
    experience_years: {
        type: Number
    },
    is_deleted: {
        type: Boolean,
        default: false
    },
    is_blocked: {
        type: Boolean,
        default: false
    },
    isVerifiedEmail: {
        type: Boolean,
        default: true
    },
    isVerifiedPhone: {
        type: Boolean,
        default: true
    },
    user_address: {
        block_number: String,
        building_name: String,
        street_address: String,
        pincode: String,
        user_city: String,
        user_state: String,
    },
    user_location: {
        type: [Number],
        index: '2dsphere'
    },
    chat_rate: Number,
    video_rate: Number,
    audio_rate: Number,
    report_rate: Number,
    client_chat_rate: Number,
    client_video_rate: Number,
    client_audio_rate: Number,
    client_report_rate: Number,
    is_chat: Boolean,
    is_video: Boolean,
    is_audio: Boolean,
    is_report: Boolean,
    astro_sign: {
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'astrosign'
    },
    google_id: String,
    facebook_id: String,
    date_of_birth: Date,
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    notification_count: {
        type: Number,
        default: 0
    },
    astrologer_status: {
        type: String,
        enum: ['online', 'busy', 'offline'],
        default: 'online'
    },
    subscribed_consumers: [{
        type: Schema.Types.ObjectId,
        ref: 'user'
    }],
    subscribed_users: [{
        service_type: {
            type: String,
            enum: ['audio', 'video', 'chat']
        },
        consumer_id: {
            type: Schema.Types.ObjectId,
            ref: 'user'
        },
        date: Date,
        notified: Boolean
    }],
    background_color: {
        red: String,
        blue: String,
        green: String,
    },
    referral_code: String,
    refer_code_blocked: {
        type: Boolean,
        default: false
    },
    added_from: {
        type: String,
        enum: ['app', 'admin', 'home']
    },
    approval_status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'approved'
    },
    pay_order_id: String, //razor pay order id
    pay_receipt: String, //razor pay receipt
    pay_payment_id: String,  //razor pay payment id
    is_listing: Boolean,  //to check if the user is in astrologer listing page
    birth_location: {
        type: [Number],
        index: '2dsphere'
    },
    birth_place: String,
    birth_time: String,
    is_chat_listing: Boolean,  //to check if the user is in chat page page
    device_type: {
        type: String,
        enum: ['ios', 'android']
    },
    shipping_name: String,
    shipping_number: String,
    change_chat_rate: Number,
    change_video_rate: Number,
    change_audio_rate: Number,
    change_report_rate: Number,
    addresses: [{
        block_number: String,
        building_name: String,
        street_address: String,
        pincode: String,
        user_city: String,
        user_state: String,
        user_location: {
            type: [Number],
            index: '2dsphere'
        },
        shipping_name: String,
        shipping_number: String,
        is_primary: Boolean
    }],
},
    {
        timestamps: true
    });

const user = module.exports = mongoose.model('user', schema);

module.exports.getAdminUser = async (req, cb) => {
    let data = await user.findOne({ email: req.email.trim().toLowerCase(), user_type: 'admin' }).then(result => result)

    console.log('getAdminUser data --- ', data);

    return data
}

module.exports.getUser = async (req, cb) => {
    let data = await user.findOne({ email: req.email.trim().toLowerCase(), user_type: req.user_type }).then(result => result)

    console.log('getUser data --- ', data);

    return data
}

module.exports.getUserByRazorId = async (req, cb) => {
    console.log('getUserByRazorId req --- ', req);

    let data = await user.findOne(req)
        .populate('astro_sign')
        .then(result => result)

    console.log('getUserByRazorId data --- ', data);

    return data
}

module.exports.getUserCount = async (req, cb) => {
    let data = await user.countDocuments({ user_type: req.body.user_type, is_deleted: false }).then(result => result)

    console.log('getUserCount data --- ', data);

    return data
}

module.exports.getUserCode = async (req, cb) => {
    let data = await user.findOne({ referral_code: req.body.referral_code, refer_code_blocked: false })
        .then(result => result)

    console.log('getUserCode data --- ', data);

    return data
}

module.exports.getUserById = async (req, cb) => {
    console.log('getUserById req --- ', req);

    let data = await user.findOne({ _id: req.user_id })
        .populate('astro_sign')
        .then(result => result)

    console.log('getUserById data --- ', data);

    return data
}

module.exports.getUserFromQuery = async (query, cb) => {
    let data = await user.findOne(query).then(result => result)

    console.log('getUserFromQuery data --- ', data);

    return data
}

module.exports.getSubscribeConsumers = async (req, cb) => {
    let data = await user.find({ user_type: 'consumer', is_listing: true, is_deleted: false }).then(result => result)

    console.log('getSubscribeConsumer data --- ', data);

    return data
}

module.exports.getUserSignin = async (req, cb) => {
    var query = {}
    if ((req.body.email && req.body.email != "") || req.body.facebook_id || req.body.google_id) {
        if (req.body.facebook_id) {
            query = { $or: [{ email: req.body.email }, { facebook_id: req.body.facebook_id }], user_type: req.body.user_type }
        } else if (req.body.google_id) {
            query = { $or: [{ email: req.body.email }, { google_id: req.body.google_id }], user_type: req.body.user_type }
        } else {
            query = { email: req.body.email.trim().toLowerCase(), user_type: req.body.user_type }
        }


    }
    if (req.body.mobile && req.body.mobile != "") {
        query = { mobile: req.body.mobile.trim().toLowerCase(), user_type: req.body.user_type }
    }
    let data = await user.findOne(query)
        .populate('astro_sign')
        .then(result => result)

    console.log('getUserSignin data --- ', data);

    return data
}

module.exports.getAllAstrologer = async (req, cb) => {

    // for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 20;
    var page = req.body.page ? parseInt(req.body.page) : 1;
    var skipPage = (page - 1) * perPage;

    let query = [];

    var searchText = (req.body.searchText == "" || req.body.searchText == undefined) ? '' : req.body.searchText;

    if (req.user && req.user.user_type == 'admin') {
        query.push({
            $match: {
                user_type: "astrologer",
                is_deleted: false,
                $or: [
                    { 'first_name': { $regex: searchText, $options: 'i' } },
                    { 'email': { $regex: searchText, $options: 'i' } },
                    { 'mobile': { $regex: searchText, $options: 'i' } }
                ]
            }
        })
    }
    else {
        query.push({
            $match: {
                user_type: "astrologer",
                is_deleted: false,
                "approval_status": "approved",
                $or: [
                    { 'first_name': { $regex: searchText, $options: 'i' } },
                    { 'email': { $regex: searchText, $options: 'i' } },
                    { 'mobile': { $regex: searchText, $options: 'i' } }
                ]
            }
        })
    }

    // apply filter only if searchtext is nil
    if (searchText == "" || (req.user && req.user.user_type == 'admin')) {
        //experience filter
        var experience = (req.body.experience == "" || req.body.experience == undefined) ? {
            $match: {}
        } : {
                $match: {
                    experience_years: { $gte: parseFloat(req.body.experience) }
                }
            }

        //consultations filter
        /*
        var match_consultation = req.body.consultation_type == 'chat' ? { 'is_chat': true } : (req.body.consultation_type == 'audio' ? {'is_audio': true } : (req.body.consultation_type == 'video' ? { 'is_video': true }  : (req.body.consultation_type == 'report' ? { 'is_report': true }  : {}) ))
        query.push({
            $match: match_consultation
        })*/
        console.log('consultation_type arr --- ', req.body.consultation_type);
        if (req.body.consultation_type && req.body.consultation_type.length > 0) {
            let orQuery = []
            if (req.body.consultation_type.includes('chat') || req.body.consultation_type.includes('Chat')) {
                orQuery.push({ 'is_chat': true })
                // query.push({
                //     $match: { 'is_chat': true }
                // })
            }
            if (req.body.consultation_type.includes('audio') || req.body.consultation_type.includes('Audio')) {
                orQuery.push({ 'is_audio': true })
                // query.push({
                //     $match: { 'is_audio': true }
                // })
            }
            if (req.body.consultation_type.includes('video') || req.body.consultation_type.includes('Video')) {
                orQuery.push({ 'is_video': true })
                // query.push({
                //     $match: { 'is_video': true }
                // })
            }
            if (req.body.consultation_type.includes('report') || req.body.consultation_type.includes('Report')) {
                orQuery.push({ 'is_report': true })
                // query.push({
                //     $match: { 'is_report': true }
                // })
            } 
            query.push({
                $match: { $or: orQuery }
            })
        }

        query.push(experience)
        query.push({
            $lookup: {
                from: "ratings",
                localField: "_id",
                foreignField: "to_id",
                as: "ratings"
            }
        })
        query.push({
            $unwind: { path: "$ratings", preserveNullAndEmptyArrays: true }
        })
        if ((req.body.languages && req.body.languages.length > 0) || (req.body.specialities && req.body.specialities.length > 0)) {
            var languages = (req.body.languages && req.body.languages.length > 0) ? req.body.languages.map(function (obj) {
                obj = ObjectId(obj)
                return obj;
            }) : []
            var specialities = (req.body.specialities && req.body.specialities.length > 0) ? req.body.specialities.map(function (obj) {
                var obj = ObjectId(obj)
                return obj;
            }) : []

            console.log('specialities --- ', specialities);
            console.log('languages --- ', languages);
            query.push({
                $project: {
                    ratings: 1,
                    specialities_common: { $setIntersection: [specialities, "$specialities"] },
                    languages_common: { $setIntersection: [languages, "$languages_spoken"] },
                    first_name: "$first_name",
                    last_name: "$last_name",
                    wallet_balance: "$wallet_balance",
                    email: "$email",
                    user_type: "$user_type",
                    mobile: "$mobile",
                    info: "$info",
                    experience_years: "$experience_years",
                    profile_url: "$profile_url",
                    createdAt: "$createdAt",
                    specialities: "$specialities",
                    languages_spoken: "$languages_spoken",
                    chat_rate: "$chat_rate",
                    video_rate: "$video_rate",
                    audio_rate: "$audio_rate",
                    report_rate: "$report_rate",
                    client_chat_rate: "$client_chat_rate",
                    client_video_rate: "$client_video_rate",
                    client_audio_rate: "$client_audio_rate",
                    client_report_rate: "$client_report_rate",
                    is_chat: "$is_chat",
                    is_video: "$is_video",
                    is_audio: "$is_audio",
                    is_report: "$is_report",
                    astrologer_status: "$astrologer_status",
                    background_color: "$background_color",
                    approval_status: "$approval_status",
                    subscribed_users: "$subscribed_users",
                }
            })
            if (languages.length > 0 && specialities.length > 0) {
                query.push({
                    $match: {
                        $expr: { $and: [{ $gt: [{ $size: "$specialities_common" }, 0] }, { $gt: [{ $size: "$languages_common" }, 0] }] }
                    }
                })
            }
            if (languages.length > 0) {
                query.push({
                    $match: {
                        $expr: { $gt: [{ $size: "$languages_common" }, 0] }
                    }
                })
            }
            if (specialities.length > 0) {
                query.push({
                    $match: {
                        $expr: { $gt: [{ $size: "$specialities_common" }, 0] }
                    }
                })
            }
        }

        query.push({
            $group: {
                _id: "$_id",
                data: { $first: "$$ROOT" },
                total_rating: { $sum: "$ratings.rating_value" },
                user_ratings: { "$push": "$ratings" }
            }
        })
        query.push({
            $project: {
                "_id": 1,
                total_rating: 1,
                rating_count: { $size: "$user_ratings" },
                first_name: "$data.first_name",
                last_name: "$data.last_name",
                wallet_balance: "$data.wallet_balance",
                email: "$data.email",
                user_type: "$data.user_type",
                mobile: "$data.mobile",
                info: "$data.info",
                experience_years: "$data.experience_years",
                profile_url: "$data.profile_url",
                createdAt: "$data.createdAt",
                specialities: "$data.specialities",
                languages_spoken: "$data.languages_spoken",
                chat_rate: "$data.chat_rate",
                video_rate: "$data.video_rate",
                audio_rate: "$data.audio_rate",
                report_rate: "$data.report_rate",
                client_chat_rate: "$data.client_chat_rate",
                client_video_rate: "$data.client_video_rate",
                client_audio_rate: "$data.client_audio_rate",
                client_report_rate: "$data.client_report_rate",
                is_chat: "$data.is_chat",
                is_video: "$data.is_video",
                is_audio: "$data.is_audio",
                is_report: "$data.is_report",
                astrologer_status: "$data.astrologer_status",
                background_color: "$data.background_color",
                avg_rating: { $round: [{ $cond: [{ $eq: [{ $size: "$user_ratings" }, 0] }, 0, { "$divide": ["$total_rating", { $size: "$user_ratings" }] }] }, 2] },
                approval_status: "$data.approval_status",
                subscribed_users: "$data.subscribed_users",
            }
        })
    }
    query.push(
        {
            $lookup: {
                from: 'specialities',
                localField: 'specialities',
                foreignField: '_id',
                as: 'specialities'
            }
        },
        {
            $lookup: {
                from: 'languages',
                localField: 'languages_spoken',
                foreignField: '_id',
                as: 'languages_spoken'
            }
        }
    )
    query.push({ $sort: { createdAt: -1 } })
    query.push(
        {
            $facet: {
                data: [{ $skip: skipPage }, { $limit: perPage }],
                totalCount: [
                    {
                        $count: 'count'
                    }
                ]
            }
        },
        { $unwind: "$totalCount" },
        {
            $project: {
                data: 1,
                totalCount: "$totalCount.count"
            }
        }
    )
    let data = []
    try {
        data = await user.aggregate([
            query
        ])
        return data
    } catch (err) {
        console.log('astrooologer ---', err);
    }
    return data
}

module.exports.getUserData = async (req, cb) => {
    console.log('getUserData --- ', req.body);

    var user_id = req.body.user_id ? req.body.user_id : req.user._id
    let data = await user.aggregate([
        {
            $match: {
                _id: ObjectId(user_id)
            }
        },
        {
            $lookup: {
                from: "ratings",
                localField: "_id",
                foreignField: "to_id",
                as: "user_ratings"
            }
        },
        {
            $unwind: { path: "$user_ratings", preserveNullAndEmptyArrays: true }
        },
        {
            $group: {
                _id: "$_id",
                data: { $first: "$$ROOT" },
                total_rating: { $sum: "$user_ratings.rating_value" },
                user_ratings: { "$push": "$user_ratings" }
            }
        },
        {
            $project: {
                "_id": 1,
                total_rating: 1,
                rating_count: { $size: "$user_ratings" },
                first_name: "$data.first_name",
                last_name: "$data.last_name",
                unique_name: "$data.unique_name",
                referral_code: "$data.referral_code",
                refer_code_blocked: "$data.refer_code_blocked",
                wallet_balance: "$data.wallet_balance",
                email: "$data.email",
                user_type: "$data.user_type",
                mobile: "$data.mobile",
                info: "$data.info",
                experience_years: "$data.experience_years",
                profile_url: "$data.profile_url",
                createdAt: "$data.createdAt",
                specialities: "$data.specialities",
                languages_spoken: "$data.languages_spoken",
                chat_rate: "$data.chat_rate",
                video_rate: "$data.video_rate",
                audio_rate: "$data.audio_rate",
                report_rate: "$data.report_rate",
                client_chat_rate: "$data.client_chat_rate",
                client_video_rate: "$data.client_video_rate",
                client_audio_rate: "$data.client_audio_rate",
                client_report_rate: "$data.client_report_rate",
                is_chat: "$data.is_chat",
                is_video: "$data.is_video",
                is_audio: "$data.is_audio",
                is_report: "$data.is_report",
                avg_rating: { $round: [{ $cond: [{ $eq: [{ $size: "$user_ratings" }, 0] }, 0, { "$divide": ["$total_rating", { $size: "$user_ratings" }] }] }, 2] },
                info: "$data.info",
                user_address: "$data.user_address",
                is_blocked: "$data.is_blocked",
                astro_sign: "$data.astro_sign",
                isVerifiedEmail: "$data.isVerifiedEmail",
                isVerifiedPhone: "$data.isVerifiedPhone",
                certifications: "$data.certifications",
                background_color: "$data.background_color",
                approval_status: "$data.approval_status",
                gender: "$data.gender",
                date_of_birth: "$data.date_of_birth",
                astrologer_status: "$data.astrologer_status",
                birth_location: "$data.birth_location",
                birth_place: "$data.birth_place",
                birth_time: "$data.birth_time",
                change_chat_rate: "$data.change_chat_rate",
                change_video_rate: "$data.change_video_rate",
                change_audio_rate: "$data.change_audio_rate",
                change_report_rate: "$data.change_report_rate",
                addresses: "$data.addresses",
                device_token: "$data.device_token",
            }
        },
        {
            $lookup: {
                from: 'specialities',
                localField: 'specialities',
                foreignField: '_id',
                as: 'specialities'
            }
        },
        {
            $lookup: {
                from: 'languages',
                localField: 'languages_spoken',
                foreignField: '_id',
                as: 'languages_spoken'
            }
        },
        {
            $lookup: {
                from: 'astrosigns',
                localField: 'astro_sign',
                foreignField: '_id',
                as: 'astro_sign'
            }
        },
        {
            $unwind: { path: "$astro_sign", preserveNullAndEmptyArrays: true }
        }
    ])

    return data
}

module.exports.getUserRating = async (req, cb) => {
    console.log('getUserRating --- ', req.body);

    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 20
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    var user_id = req.body.user_id ? req.body.user_id : req.user._id

    let data = await user.aggregate([
        {
            $match: {
                _id: ObjectId(user_id)
            }
        },
        {
            $lookup: {
                from: 'specialities',
                localField: 'specialities',
                foreignField: '_id',
                as: 'specialities'
            }
        },
        {
            $lookup: {
                from: 'languages',
                localField: 'languages_spoken',
                foreignField: '_id',
                as: 'languages_spoken'
            }
        },
        {
            $lookup: {
                from: 'astrosigns',
                localField: 'astro_sign',
                foreignField: '_id',
                as: 'astro_sign'
            }
        },
        {
            $unwind: { path: "$astro_sign", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "ratings",
                localField: "_id",
                foreignField: "to_id",
                as: "ratings"
            }
        },
        {
            $unwind: { path: "$ratings", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "ratings.from_id",
                foreignField: "_id",
                as: "ratings.from_id"
            }
        },
        {
            $unwind: { path: "$ratings.from_id", preserveNullAndEmptyArrays: true }
        },
        { $sort: { 'ratings.createdAt': -1 } },
        {
            $group: {
                _id: "$_id",
                data: { $first: "$$ROOT" },
                total_rating: { $sum: "$ratings.rating_value" },
                "five_stars": {
                    "$sum": { "$cond": [{ "$eq": ["$ratings.rating_value", 5] }, 1, 0] }
                },
                "four_stars": {
                    "$sum": { "$cond": [{ "$eq": ["$ratings.rating_value", 4] }, 1, 0] }
                },
                "three_stars": {
                    "$sum": { "$cond": [{ "$eq": ["$ratings.rating_value", 3] }, 1, 0] }
                },
                "two_stars": {
                    "$sum": { "$cond": [{ "$eq": ["$ratings.rating_value", 2] }, 1, 0] }
                },
                "one_stars": {
                    "$sum": { "$cond": [{ "$eq": ["$ratings.rating_value", 1] }, 1, 0] }
                },
                "user_ratings":
                {
                    $push:
                    {
                        _id: "$ratings._id",
                        description: "$ratings.description",
                        to_id: "$ratings.to_id",
                        from_id: "$ratings.from_id",
                        rating_value: "$ratings.rating_value",
                        createdAt: "$ratings.createdAt",
                        is_deleted: "$ratings.is_deleted",
                        updatedAt: "$ratings.updatedAt",
                    }
                }
            }
        },
        {
            $project: {
                "_id": 1,
                total_rating: 1,
                rating_count: { $size: "$user_ratings" },
                five_stars: 1,
                four_stars: 1,
                three_stars: 1,
                two_stars: 1,
                one_stars: 1,
                user_ratings: 1,
                first_name: "$data.first_name",
                last_name: "$data.last_name",
                wallet_balance: "$data.wallet_balance",
                email: "$data.email",
                user_type: "$data.user_type",
                mobile: "$data.mobile",
                info: "$data.info",
                experience_years: "$data.experience_years",
                profile_url: "$data.profile_url",
                createdAt: "$data.createdAt",
                specialities: "$data.specialities",
                languages_spoken: "$data.languages_spoken",
                chat_rate: "$data.chat_rate",
                video_rate: "$data.video_rate",
                audio_rate: "$data.audio_rate",
                report_rate: "$data.report_rate",
                client_chat_rate: "$data.client_chat_rate",
                client_video_rate: "$data.client_video_rate",
                client_audio_rate: "$data.client_audio_rate",
                client_report_rate: "$data.client_report_rate",
                is_chat: "$data.is_chat",
                is_video: "$data.is_video",
                is_audio: "$data.is_audio",
                is_report: "$data.is_report",
                avg_rating: { $round: [{ $cond: [{ $eq: [{ $size: "$user_ratings" }, 0] }, 0, { "$divide": ["$total_rating", { $size: "$user_ratings" }] }] }, 2] },
                info: "$data.info",
                user_address: "$data.user_address",
                is_blocked: "$data.is_blocked",
                astro_sign: "$data.astro_sign",
                background_color: "$data.background_color",
                approval_status: "$data.approval_status",
                birth_location: "$data.birth_location",
                birth_place: "$data.birth_place"
            }
        }
    ])

    return data
}

module.exports.getAllConsumers = async (req, cb) => {

    // for pagination
    let perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    let page = req.body.page ? parseInt(req.body.page) : 1
    let skipPage = (page - 1) * perPage;

    // let data = await user.find({ user_type: "consumer", is_deleted: false })
    //     .limit(perPage)
    //     .skip(skipPage)
    //     .then(result => result)
    // return data

    let query = [];
    let searchText = (req.body.searchText == "" || req.body.searchText == undefined) ? '' : req.body.searchText;

    if (searchText !== '') {
        query.push({
            $match: {
                user_type: 'consumer',
                is_deleted: false,
                $or: [
                    { 'first_name': { $regex: searchText, $options: 'i' } },
                    { 'email': { $regex: searchText, $options: 'i' } },
                    { 'mobile': { $regex: searchText, $options: 'i' } }
                ]
            }
        })
    }
    else {
        query.push({
            $match: {
                user_type: 'consumer',
                is_deleted: false,
            }
        })
    }

    query.push({ $sort: { createdAt: -1 } })
    query.push(
        {
            $facet: {
                data: [{ $skip: skipPage }, { $limit: perPage }],
                totalCount: [
                    {
                        $count: 'count'
                    }
                ]
            }
        },
        { $unwind: '$totalCount' },
        {
            $project: {
                data: 1,
                totalCount: '$totalCount.count'
            }
        }
    )
    try {
        let data = await user.aggregate([
            query
        ])
        return data
    } catch (err) {
        console.log('CONSUMER AGGREGATE ERROR :', err);
    }
    return data

}

module.exports.getUsers = async (req, cb) => {
    let data = await user.find({ user_type: "astrologer", is_deleted: false })
        .select({ "first_name": 1, "_id": 1 })
        .then(result => result)

    return data
}

module.exports.getUsersByType = async (req, cb) => {
    var query = req.body.user_type == 'all' ? { is_deleted: false } : { user_type: req.body.user_type, is_deleted: false }
    let data = await user.find(query)
        .then(result => result)

    return data
}

module.exports.getAllReferrors = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await user.aggregate([
        {
            $match: {

            }
        },
        {
            $lookup: {
                from: 'referrals',
                localField: '_id',
                foreignField: 'referror_id',
                as: 'referrals'
            }
        },
        { $unwind: { path: "$referrals", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'users',
                localField: 'referrals.used_by_id',
                foreignField: '_id',
                as: 'referrals.used_by_id'
            }
        },
        { $unwind: { path: "$referrals.used_by_id", preserveNullAndEmptyArrays: true } },
        {
            $match: { $or: [{ user_type: "referror" }, { "referrals.used_by_id.approval_status": "approved" }] }
        },
        {
            $group: {
                _id: "$_id",
                data: { $first: "$$ROOT" },
            }
        },
        {
            $project: {
                "_id": 1,
                first_name: "$data.first_name",
                last_name: "$data.last_name",
                wallet_balance: "$data.wallet_balance",
                email: "$data.email",
                user_type: "$data.user_type",
                mobile: "$data.mobile",
                info: "$data.info",
                profile_url: "$data.profile_url",
                createdAt: "$data.createdAt",
                languages_spoken: "$data.languages_spoken",
                is_chat: "$data.is_chat",
                is_video: "$data.is_video",
                is_audio: "$data.is_audio",
                is_report: "$data.is_report",
                user_address: "$data.user_address",
                is_blocked: "$data.is_blocked",
                astro_sign: "$data.astro_sign",
                background_color: "$data.background_color",
                approval_status: "$data.approval_status",
                referral_code: "$data.referral_code",
                refer_code_blocked: "$data.refer_code_blocked"
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $facet: {
                data: [{ $skip: skipPage }, { $limit: perPage }],
                totalCount: [
                    {
                        $count: 'count'
                    }
                ]
            }
        },
        { $unwind: "$totalCount" },
        {
            $project: {
                data: 1,
                totalCount: "$totalCount.count"
            }
        }
    ])

    return data
}

module.exports.fetchAllAstrologer = async (req, cb) => {
    
    let data = await user.find({ user_type: 'astrologer', is_deleted: false }).then(result => result)

    return data
}