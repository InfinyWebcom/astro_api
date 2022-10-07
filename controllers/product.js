/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const languagesModel = require('../models/language');
const specialityModel = require('../models/speciality');
const serviceModel = require('../models/service');
const productModel = require('../models/product');
const userModel = require('../models/user');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
var jwt = require('jsonwebtoken');


/*
# parameters: token,
# purpose: get all products for admin
*/
const getProductsList = async (req, res) => {

    const token = req.headers.token ? req.headers.token : req.query.token;
    const decoded = jwt.decode(token, process.env.jwtKey);
    req.user_type = decoded && decoded.user_type ? decoded.user_type : '';
    console.log('\n\nUSER TYPE', req.user_type);

    let products = await productModel.getProductList(req);
    let isData = products.length == 0 ? false : true;
    let productList = isData ? products[0].data : [];
    let productPerOrder = await productModel.getOrderPerProduct(req);

    // console.log('\n\naddtoCart products---', JSON.stringify(products), '\n\n')
    // console.log('addtoCart productPerOrder---', productPerOrder)
    console.log('\n\nProducts Loop:', productPerOrder)

    productList.forEach((product, i) => {
        if (productPerOrder.length > 0) {

            let index = productPerOrder.findIndex((e) => e._id && e._id.toString() == product._id && product._id.toString())

            if (index > -1) {
                productList[i].order_count = productPerOrder[index].order_count
            }
            else {
                productList[i].order_count = 0
            }
        }
        else {
            productList[i].order_count = 0
        }
    });

    return res.status(200).json({
        error: false,
        data: productList,
        total_count: isData ? products[0].total_count : 0
    })
}

/*
# parameters: token, name, description, rate
# purpose: add Products
*/
const addProduct = async (req, res) => {
    console.log('addProduct req.body', req.body)

    const result = validationResult(req);
    console.log('addProduct errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let dir = './assets/products/';
    let tempfileName = helper.base64Upload(dir, req.body.image_url)
    var fileName = tempfileName + '.jpg';

    var newProduct = new productModel({
        name: req.body.name.trim(),
        description: req.body.description.trim(),
        rate: parseFloat(req.body.rate).toFixed(2),
        image_url: '/products/' + tempfileName
    })
    // generate thumbnail
    setTimeout(function () {
        helper.getThumbnail(dir, fileName, tempfileName, function (status) {
            console.log('addProduct getThumbnail -- ', status);
        });
    }, 2000);

    newProduct.save((err, productData) => {
        console.log('savedProduct userData save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update product details.',
                error: true
            });
        }

        return res.status(200).json({
            title: "Product saved successfully",
            error: false,
            data: productData
        });
    })
}

/*
# parameters: token, name, description, rate
# purpose: edit Products
*/
const editProduct = async (req, res) => {
    console.log('editProduct req.body', req.body)

    const result = validationResult(req);
    console.log('editProduct errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let productData = await productModel.getProductById(req.body);

    if (!productData) {
        return res.status(200).json({
            title: 'Product not found',
            error: true
        })
    }
    productData.name = req.body.name
    productData.description = req.body.description
    productData.rate = parseFloat(req.body.rate).toFixed(2)

    if (req.body.image_url && req.body.image_url != "") {
        console.log('editProduct req.body', req.body.image_url.length)

        let newBase64Str = req.body.image_url.replace(/(\r\n|\n|\r)/gm, "")
        var matches = newBase64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        console.log('editProduct matches', matches)
        if (!matches || matches.length !== 3) {
            console.log('editProduct matches error')
        }
        else if (req.body.image_url && req.body.image_url != "") {
            if (productData.image_url && productData.image_url.length > 0) {
                var oldImage = './assets' + productData.image_url + '.jpg';
                var oldSmallImage = './assets' + productData.image_url + '_small.jpg';
                var oldMedImage = './assets' + productData.image_url + '_medium.jpg';
                helper.unlinkFile(oldImage);
                helper.unlinkFile(oldSmallImage);
                helper.unlinkFile(oldMedImage);
            }
            let dir = './assets/products/';
            let tempfileName = helper.base64Upload(dir, req.body.image_url)
            var fileName = tempfileName + '.jpg';
            productData.image_url = '/products/' + tempfileName

            // generate thumbnail
            setTimeout(function () {
                helper.getThumbnail(dir, fileName, tempfileName, function (status) {
                    console.log('addService getThumbnail -- ', status);
                });
            }, 2000);
        }
    }

    productData.save((err, savedProdct) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update product details.',
                error: true
            });
        }

        return res.status(200).json({
            title: "Product edited successfully",
            error: false,
            data: savedProdct
        });
    })
}

/*
# parameters: token
# purpose: To delete product
*/
const deleteProduct = async (req, res) => {
    console.log('deleteProduct req.body ', req.body);

    const result = validationResult(req);
    console.log('deleteProduct errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let productData = await productModel.getProductById(req.body);

    if (!productData) {
        return res.status(200).json({
            title: 'Product not found',
            error: true
        })
    }

    productData.is_deleted = true
    productData.save((err, savedProduct) => {
        console.log('deleteService savedProduct save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update product details.',
                error: true
            });
        }
        return res.status(200).json({
            title: "Product deleted successfully",
            error: false,
            data: savedProduct
        });
    })
}

/*
# parameters: token
# purpose: To hide/unhide product
*/
const hideProduct = async (req, res) => {
    console.log('deleteProduct req.body ', req.body);

    const result = validationResult(req);
    console.log('deleteProduct errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let productData = await productModel.getProductById(req.body);

    if (!productData) {
        return res.status(200).json({
            title: 'Product not found',
            error: true
        })
    }

    var title = "This product will not be visible to the consumers"
    if (productData.is_hidden == true) {
        productData.is_hidden = false
        title = "This product will now be visible to the consumers"
    }
    else {
        productData.is_hidden = true
    }

    productData.save((err, savedProduct) => {
        console.log('deleteService savedProduct save err ', err);

        if (err) {
            return res.status(200).json({
                title: 'Something went wrong when trying to update product details.',
                error: true
            });
        }
        return res.status(200).json({
            title: title,
            error: false,
            data: savedProduct
        });
    })
}

/*
# parameters: token
# purpose: To get product
*/
const getProductDetails = async (req, res) => {
    console.log('getProductDetails req.body ', req.body);

    const result = validationResult(req);
    console.log('getProductDetails errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let productData = await productModel.getProductById(req.body);

    if (!productData) {
        return res.status(200).json({
            title: 'Product not found',
            error: true
        })
    }
    return res.status(200).json({
        title: "Product details",
        error: false,
        data: productData
    });
}

module.exports = {
    getProductsList,
    addProduct,
    editProduct,
    deleteProduct,
    hideProduct,
    getProductDetails
} 