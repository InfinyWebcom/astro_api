var moment = require('moment-timezone');
var jwt = require('jsonwebtoken');
let user = require('../models/user');
let groupModule = require('../models/permissionGroup');
let permissionModule = require('../models/permissionModule');
const helper = require('../lib/helper');

const isAuthenticated = function (data) {
    return async(req, res, next) => {
        let decoded = await jwt.verify(req.headers.token, 'astroapi',function(err,decoded){
            return decoded; 
        });
        console.log('decoded', decoded)

        var updatedAt = new Date();
        let errLog = '\r\n########## \r\n' + new Date(updatedAt.getTime() + moment.tz(helper.getTimezone()).utcOffset() * 60000) + "\r\n";

        errLog += `decoded ---- ${JSON.stringify(decoded)} \r\n`;
        errLog += `data inside isAuthenticated---- ${JSON.stringify(data)} \r\n`;
        
        //check whether the path requested by the user is present in config.js file if not send error.
        let user_type = decoded.user_type;
        console.log('req.user', req.user)

        let groupData = await groupModule.findById({_id: req.user.groupId}).populate('permissions').exec()
        console.log('groupData--',groupData)
        console.log('groupData.permissions',groupData.permissions)

        let groupDataCheck = await groupModule.findById({_id: req.user.groupId}).exec()
        console.log('groupDataCheck--',groupDataCheck)

        console.log('req.body...........',req.body)
        let tempPermission = [...groupData.permissions]
        
        let isExists = tempPermission.some((val)=>val.action.findIndex((value)=>value==data)!==-1)
        console.log('isExists', isExists)

        if (!decoded || decoded == undefined) {
            helper.writeFile(errLog, 'accessLog');
            return res.status(200).json({
                error: true,
                title: 'Invalid access token.'
            });
        }
        
        if(decoded.isMobile&&isExists){
            // for mobile users
            return next()
        } else if (!decoded.isMobile&&isExists) {
            // all user can access the route
            return next()
        }
        else {
            helper.writeFile(errLog, 'accessLog');
            return res.status(200).json({
                error: true,
                title: 'Invalid access token.',
                details:tempPermission
            });
        }
    }
}

const authenticateUser = async (req, res, next) => {
    const token = req.headers.token ? req.headers.token : req.query.token; 
    const decoded = jwt.decode(token, "astroapi");
    console.log("decoded authenticateUser",decoded, token)
    try {
        const userData = await user.findById(decoded.user_id).exec();

        console.log("decoded userData",userData)
        if (!userData || userData == undefined) {
            return res.status(200).json({
                title: 'user not found',
                error: true,
            });
        }
        if (userData.is_deleted == true) {
            return res.status(200).json({
                title: 'You are deleted by admin',
                error: true,
            });
        }
        if (userData.is_blocked == true) {
            return res.status(200).json({
                title: 'You are blocked by admin',
                error: true,
            });
        }
        req.user = userData;
        return next(null, userData);
    }
    catch (error) {
        return res.status(200).json({
            title: 'Authorization required.',
            error: true,
        });
    }  
}

module.exports = {
    isAuthenticated,
    authenticateUser
}