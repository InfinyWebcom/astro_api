/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
var jwt = require('jsonwebtoken');

/* Models */
const languagesModel = require('../models/language');
const specialityModel = require('../models/speciality');
const serviceModel = require('../models/service');
const userModel = require('../models/user');

/*
# parameters: token,
# purpose: get all services for admin
*/
const getServicesList = async (req, res) => {
    
    const token = req.headers.token ? req.headers.token : req.query.token;
    const decoded = jwt.decode(token, process.env.jwtKey);
    req.user_type = decoded && decoded.user_type ? decoded.user_type : '';
    console.log('getServicesList USER TYPE :-', req.user_type);

    let services = await serviceModel.getServiceList(req);
    let isData = services.length == 0 ? false : true;
    let serviceList = isData ? services[0].data : [];

    return res.status(200).json({
        error: false,
        data: serviceList,
        total_count: isData ? services[0].total_count : 0
    })
}

/*
# parameters: token, name, description, rate
# purpose: add services
*/
const addService = async (req, res) => {
    console.log('addService req.body', req.body)

    const result = validationResult(req);
    console.log('addService errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let dir = './assets/services/';
    let tempfileName = helper.base64Upload(dir, req.body.image_url)
    var fileName = tempfileName + '.jpg';

    var newService = new serviceModel({
        name: req.body.name,
        description: req.body.description,
        rate: parseFloat(req.body.rate).toFixed(2),
        image_url: '/services/' + tempfileName
    })
    // generate thumbnail
    setTimeout(function () {
        helper.getThumbnail(dir, fileName, tempfileName, function (status) {
            console.log('addService getThumbnail -- ', status);
        });
    }, 2000);

    newService.save((err, serviceData) => {
        console.log('addService userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update service details.',
                error: true
            });
        }

        return res.status(200).json({
            title: "Service saved successfully",
            error: false,
            data: serviceData
        });
    })  
}

/*
# parameters: token, name, description, rate
# purpose: edit services
*/
const editService = async (req, res) => {
    console.log('editService req.body', req.body)

    const result = validationResult(req);
    console.log('editService errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await serviceModel.getServiceById(req.body);

    if (!serviceData) {
        return res.status(200).json({
            title: 'Service not found',
            error: true
        })
    }
    serviceData.name = req.body.name
    serviceData.description = req.body.description
    serviceData.rate = parseFloat(req.body.rate).toFixed(2)

    var matches = req.body.image_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    console.log('editService matches', matches)
    if (!matches || matches.length !== 3) {
        console.log('editService matches error')
    }
    else if (req.body.image_url && req.body.image_url != "") {
        if (serviceData.image_url && serviceData.image_url.length > 0) {
            var oldImage = './assets' + serviceData.image_url + '.jpg';
            var oldSmallImage = './assets' + serviceData.image_url + '_small.jpg';
            var oldMedImage = './assets' + serviceData.image_url + '_medium.jpg';
            helper.unlinkFile(oldImage);
            helper.unlinkFile(oldSmallImage);
            helper.unlinkFile(oldMedImage);
        }
        let dir = './assets/services/';
        let tempfileName = helper.base64Upload(dir, req.body.image_url)
        var fileName = tempfileName + '.jpg';
        serviceData.image_url = '/services/' + tempfileName
        // generate thumbnail
        setTimeout(function () {
            helper.getThumbnail(dir, fileName, tempfileName, function (status) {
                console.log('addService getThumbnail -- ', status);
            });
        }, 2000);
    }
    serviceData.save((err, savedService) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update service details.',
                error: true
            });
        }

        return res.status(200).json({
            title: "Service edited successfully",
            error: false,
            data: savedService
        });
    })    
}

/*
# parameters: token
# purpose: To delete service
*/
const deleteService = async (req, res) => {
    console.log('deleteService req.body ', req.body);
    
    const result = validationResult(req);
    console.log('deleteService errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await serviceModel.getServiceById(req.body);

    if (!serviceData) {
        return res.status(200).json({
            title: 'Service not found',
            error: true
        })
    }
    
    serviceData.is_deleted = true
    serviceData.save((err, savedService) => {
        console.log('deleteService savedService save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update service details.',
                error: true
            });
        }
        return res.status(200).json({
            title: "Service deleted successfully",
            error: false,
            data: savedService
        });
    })   
}

/*
# parameters: token
# purpose: To hide/unhide service
*/
const hideService = async (req, res) => {
    console.log('hideService req.body ', req.body);
    
    const result = validationResult(req);
    console.log('hideService errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await serviceModel.getServiceById(req.body);

    if (!serviceData) {
        return res.status(200).json({
            title: 'Service not found',
            error: true
        })
    }

    var title = "This service will not be visible to the consumers"
    if (serviceData.is_hidden == true) {
        serviceData.is_hidden = false
        title = "This service will now be visible to the consumers"
    }
    else {
        serviceData.is_hidden = true
    }
    serviceData.save((err, savedService) => {
        console.log('deleteService savedService save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update service details.',
                error: true
            });
        }
        return res.status(200).json({
            title: title,
            error: false,
            data: savedService
        });
    })   
}

/*
# parameters: token
# purpose: To get service
*/
const getServiceDetails = async (req, res) => {
    console.log('getServiceDetails req.body ', req.body);
    
    const result = validationResult(req);
    console.log('getServiceDetails errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let serviceData = await serviceModel.getServiceById(req.body);

    if (!serviceData) {
        return res.status(200).json({
            title: 'Service not found',
            error: true
        })
    }
    return res.status(200).json({
        title: "Service details",
        error: false,
        data: serviceData
    });
}

/*
# parameters: userToken
# Variables used : token, decoded
# purpose: get products and services
*/
const getProductsAndServices = async (req, res) => {
    let data = await serviceModel.getProductsServices(req);
    console.log('getProductsAndServices data', data)

    return res.status(200).json({
        title: "Astroshop listing",
        error: false,
        data: data
    })
}

module.exports = {
    getServicesList,
    addService,
    editService,
    deleteService,
    hideService,
    getServiceDetails,
    getProductsAndServices
}   