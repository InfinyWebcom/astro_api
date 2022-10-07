var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = mongoose.Types.ObjectId;

var schema = new Schema({
    user_id: {       //the user who gets the notification
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    sec_user_id: {       //the user who gets the notification
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'user'
    },
    message: {
        type: String,
        required: true
    },
    flag: {
        type: String,
        required: true
    },
    targetedScreen: String
}, {
    timestamps: true
});

const notification = module.exports = mongoose.model('notification', schema);

module.exports.addNotification = (userData, cb) => {
    let newNotification = new notification({
        user_id: userData.user_id,
        sec_user_id: userData.sec_user_id,
        message: userData.message,
        flag: userData.flag
    });

    newNotification.save((error, response) => {
        if (error) {
            return cb(error);
        }
        else {
            return cb(null, response);
        }
    });
}

module.exports.getNotifications = async (req, cb) => {
    //for pagination
    var perPage = req.body.perPage ? parseInt(req.body.perPage) : 10
    var page = req.body.page ? parseInt(req.body.page) : 1
    var skipPage = (page - 1) * perPage;

    let data = await notification.aggregate([
        {
            $match: {
                user_id: ObjectId(req.user._id)
            }
        },
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_id"
            }
        },
        {
            $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "sec_user_id",
                foreignField: "_id",
                as: "sec_user_id"
            }
        },
        {
            $unwind: { path: "$sec_user_id", preserveNullAndEmptyArrays: true }
        },
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

    console.log('getNotifications ---', data);

    return data
}