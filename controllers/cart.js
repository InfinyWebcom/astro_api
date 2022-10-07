/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const helper = require('../lib/helper');
const { check, validationResult, body } = require('express-validator');
const randomstring = require("randomstring");

/* Model */
const userModel = require('../models/user');
const notificationModel = require('../models/notification');
const cartModel = require('../models/cart');

/*
# parameters: token,
# purpose: add to Cart
*/
const addtoCart = async(req, res) => {
    console.log('addtoCart req.body---', req.body)
    console.log('addtoCart req.user---', req.user)

    const result = validationResult(req);
    console.log('addtoCart errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let cartdata = await cartModel.getCart(req.user);
    console.log('addtoCart cartdata---', cartdata)
    let cartData = cartdata ? cartdata : new cartModel({ user_id: req.user._id, cart_details: [] })

    console.log('addtoCart cartData---', cartData)

    let index = cartData.cart_details.findIndex((e) => e.product_id._id.toString() == req.body.product_id.toString())
    console.log('addtoCart index---', index)

    if (index > -1) {
        cartData.cart_details[index].quantity = cartData.cart_details[index].quantity + parseInt(req.body.quantity)
    }
    else {
        cartData.cart_details.push({ product_id: req.body.product_id, quantity: parseInt(req.body.quantity) })
    }

    cartData.save((error, newCartData) => {
        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }

        newCartData
        .populate('cart_details.product_id')
        .execPopulate()
        .then(function (newCart) {

            return res.status(200).json({
                title: 'Product added successfully',
                error: false,
                data: newCart
            });
        })
        
    })
}

/*
# parameters: token,
# purpose: get cart details
*/
const getCartDetails = async(req, res) => { 
    let data = await cartModel.getCartData(req);

    return res.status(200).json({
        title: 'Cart details',
        error: false,
        data: data
    });
}

/*
# parameters: token,
# purpose: remove item from cart
*/
const removeFromCart = async(req, res) => {
    console.log('addtoCart req.body---', req.body)
    console.log('addtoCart req.user---', req.user)

    const result = validationResult(req);
    console.log('addtoCart errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let cartData = await cartModel.getCart(req.user);

    console.log('removeFromCart cartData---', cartData)

    let index = cartData.cart_details.findIndex((e) => e.product_id._id.toString() == req.body.product_id.toString())
    console.log('removeFromCart index---', index)

    if (index > -1) {
        var quantity = cartData.cart_details[index].quantity - parseInt(req.body.quantity)
        if (quantity < 1) {
            cartData.cart_details.splice(index, 1);
        }
        else {
            cartData.cart_details[index].quantity = quantity
        }
    }
    /*
    if (index > -1) {
        cartData.cart_details.splice(index, 1);
    }*/
    
    console.log('removeFromCart cartData.cart_details---', cartData.cart_details)

    cartData.save((error, newCartData) => {
        console.log('removeFromCart cartData---', error, newCartData)
        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }
        return res.status(200).json({
            title: 'Cart removed successfully.',
            error: false,
            data: newCartData
        });
    })
}

module.exports = {
    addtoCart,
    getCartDetails,
    removeFromCart
}