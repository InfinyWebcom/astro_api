/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const bcrypt = require('bcryptjs');
const helper = require('../lib/helper');
const randomstring = require("randomstring");
const { check, validationResult, body } = require('express-validator');
const nodeGeocoder = require('node-geocoder');

/* Models */
const transModel = require('../models/transaction');
const requestModel = require('../models/serviceRequest')

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

/*
# parameters: token,
# purpose: To list transactions
*/
const transactionsListing = async (req, res) => {
    console.log('transactionsListing req.body -- ', req.body);
    console.log('transactionsListing req.user---', req.user)

    let data = await transModel.getTransactions(req);

    console.log('transactionsListing data ', data);

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "Transactions listing",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0,
        wallet_balance: req.user.wallet_balance
    })
}

/*
# parameters: token,
# purpose: To list walet trnsactions
*/
const walletTransactionList = async (req, res) => {
    console.log('walletTransactionList req.body -- ', req.body);
    console.log('walletTransactionList req.user---', req.user)

    let data = await transModel.getWalletTransactions(req);

    console.log('walletTransactionList data ', data);

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: "Wallet listing",
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    })
}

module.exports = {
    transactionsListing,
    walletTransactionList
}