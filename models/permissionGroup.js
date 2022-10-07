var mongoose = require('mongoose')

var permissionGroup = mongoose.Schema({
    name: String,
    permissions: [{
        type: mongoose.SchemaTypes.ObjectId,
        ref: 'permissionModule'
    }],
    isDeleted: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true
})

module.exports = mongoose.model('permissionGroup', permissionGroup)