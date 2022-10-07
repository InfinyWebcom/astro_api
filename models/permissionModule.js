var mongoose = require('mongoose');

var permissionModule = mongoose.Schema({
    name: String,
    isDeleted: {
        type: Boolean,
        default: false
    },  
    action: [String]
}, {
    timestamps: true
})

module.exports = mongoose.model('permissionModule', permissionModule)