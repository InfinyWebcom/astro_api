/* NODE-MODULES */
const async = require('async');
var mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const helper = require('../lib/helper');
const { check, validationResult, body } = require('express-validator');
const randomstring = require("randomstring");
const Razorpay = require('razorpay')
const CourierService = require('../lib/courierService')
var moment = require('moment');
const nodeSchedule = require('node-schedule');

/* Model */
const userModel = require('../models/user');
const notificationModel = require('../models/notification');
const productOrderModel = require('../models/productOrder');
const cartModel = require('../models/cart');
const transModel = require('../models/transaction');
const serviceModel = require('../models/service');
const serviceReqModel = require('../models/serviceRequest');
const ratingModel = require('../models/rating');
const chatSessionModel = require('../models/chatSession');
const offerModel = require('../models/offer');

/* CONTROLLER MODULES */
const notificationController = require('../controllers/notification');

/*
# parameters: token,
# purpose: Create order
*/
const createOrder = async (req, res) => {

    console.log('createOrder req.user---', req.user)
    console.log('createOrder req.body---', req.body)

    let cartdata = await cartModel.getCart(req.user);
    console.log('createOrder cartdata---', cartdata)

    if (!cartdata || cartdata.length == 0) {
        return res.status(200).json({
            title: 'No Cart found',
            error: true,
        });
    }

    let addressesObj = {};
    let index = -1;
    if (req.body.address_id) {
        index = req.user.addresses.findIndex((e) => e._id.toString() == req.body.address_id.toString())
        addressesObj = {
            block_number: req.user.addresses[index].block_number,
            building_name: req.user.addresses[index].building_name,
            street_address: req.user.addresses[index].street_address,
            pincode: req.user.addresses[index].pincode,
            user_city: req.user.addresses[index].user_city,
            user_state: req.user.addresses[index].user_state,
            user_location: req.user.addresses[index].user_location,
            shipping_name: req.user.addresses[index].shipping_name,
            shipping_number: req.user.addresses[index].shipping_number,
        }
    }

    // unique number
    var order_number = randomstring.generate(7);

    // Saving user id also as "consumer_id" to be able to generate summary in "getSummaryCount"
    var newOrder = new productOrderModel({
        order_number: order_number,
        user_id: req.user._id,
        consumer_id: req.user._id,
        products: [],
        is_viewed: false,
        user_address: addressesObj
    })

    var total_amount = 0
    var productString = ""

    cartdata.cart_details.forEach(cart => {
        var arrObj = {}
        console.log('createOrder cart.product_id---', cart.product_id)

        arrObj.product_id = cart.product_id._id
        arrObj.quantity = cart.quantity
        arrObj.rate = parseFloat(cart.product_id.rate).toFixed(2)

        newOrder.products.push(arrObj)

        total_amount = total_amount + parseFloat(cart.product_id.rate) * parseFloat(cart.quantity)

        productString = productString + cart.quantity + " " + cart.product_id.name
        if (cartdata.cart_details.length != newOrder.products.length) {
            productString = productString + ", "
        }
    });
    console.log('createOrder total_amount---', total_amount)

    newOrder.total_amount = parseFloat(total_amount).toFixed(2)

    var res_title = "Order created successfully"

    let userWalletBalance = req.user.wallet_balance;
    async.waterfall([
        function (firstCallback) {

            // check if user selected wallet option            
            var payAmount = total_amount;
            console.log('\n\nCHECK 1');

            if (req.body.is_wallet && (req.body.is_wallet == true || req.body.is_wallet == 'true') && req.user.wallet_balance > 0) {
                console.log('\n\nCHECK 2');

                var transAmount = 0;

                if (userWalletBalance - total_amount >= 0) {
                    console.log('\n\nCHECK 3');

                    req.user.wallet_balance = parseFloat(req.user.wallet_balance - total_amount).toFixed(2);
                    transAmount = total_amount;
                    payAmount = 0;

                    // order success from wallet
                    newOrder.order_status = [{
                        status: "New",
                        description: "Order placed successfully",
                        date: new Date()
                    }],
                        newOrder.current_status = "New"
                }
                else {
                    console.log('\n\nCHECK 3.2');
                    transAmount = req.user.wallet_balance
                    payAmount = parseFloat(total_amount - req.user.wallet_balance).toFixed(2)
                    // req.user.wallet_balance = 0
                }
                console.log('createOrder firstCallback transAmount ', transAmount, payAmount);

                newOrder.save((error, savedOrder) => {
                    console.log('createOrder error---', error)
                    if (error) {
                        return firstCallback(null, true, undefined);
                    }
                    else {
                        console.log('\n\nCHECK 4');
                        if (userWalletBalance - total_amount >= 0) {
                            console.log('\n\nCHECK 5');

                            var transData = new transModel({
                                transaction_type: 'product',
                                product_order_id: savedOrder._id,
                                consumer_id: req.user._id,
                                payment_status: "success",
                                payment_type: "wallet",
                                transaction_amt: transAmount,
                                client_transaction_amt: transAmount
                            })

                            transModel.saveTransaction(transData, (err, savedData) => {
                                if (err) {
                                    return firstCallback(null, true, undefined);
                                }
                                req.user.save((error, savedUser) => {
                                    console.log('\n\nCHECK 6');

                                    console.log('createOrder savedTrans---', error, savedUser)

                                    if (error) {
                                        return firstCallback(null, true, undefined);
                                    }

                                    return firstCallback(null, false, payAmount);
                                })
                            })
                        }
                        else {
                            console.log('\n\nCHECK 5.2');
                            req.user.save((error, savedUser) => {
                                console.log('createOrder savedTrans---', error, savedUser)
                                if (error) {
                                    return firstCallback(null, true, undefined);
                                }

                                return firstCallback(null, false, payAmount);
                            })
                        }
                    }

                })

            }
            else {
                console.log('\n\nCHECK 1.2');
                console.log('createOrder firstCallback else');
                return firstCallback(null, false, payAmount);
            }

        },
        function (err, payAmount, secCallback) {
            console.log('createOrder secCallback payAmount---', err, payAmount)

            if (err) {
                return secCallback(error, true)
            }
            if (payAmount > 1) {

                let use_wallet = false;
                let wallet_amt_used = 0;

                if (req.body.is_wallet && (req.body.is_wallet == true || req.body.is_wallet == 'true') && userWalletBalance > 0) {
                    if (userWalletBalance - total_amount < 0) {
                        use_wallet = true;
                        wallet_amt_used = req.user.wallet_balance;
                    }
                }

                res_title = "Please pay the amount to sent request."

                // razor pay
                var instance = new Razorpay({ key_id: process.env.razor_key_id, key_secret: process.env.razor_key_secret })

                var options = {
                    amount: parseFloat(payAmount).toFixed(2) * 100,  // amount in the smallest currency unit
                    currency: "INR",
                    receipt: order_number,
                    notes: {
                        order_type: 'order',
                        order_number: order_number,
                        use_wallet: use_wallet,
                        wallet_amt_used: wallet_amt_used,
                    }
                };

                instance.orders.create(options, function (err, order) {
                    console.log('createOrder razor instance err', err);
                    if (err) {
                        return secCallback(err, true)
                    }

                    console.log('createOrder razor instance order', order);

                    newOrder.pay_order_id = order.id
                    newOrder.pay_receipt = order.receipt
                    newOrder.payment_status = 'pending'
                    newOrder.save((error, savedOrder) => {
                        console.log('createOrder error---', error)

                        if (error) {
                            return secCallback(error, true)
                        }
                        var data = new Object();
                        data = savedOrder.toObject({ getters: true })
                        data.payAmount = parseFloat(payAmount).toFixed(2)
                        return secCallback(null, data)
                    })

                });

            }
            else {
                newOrder.payment_status = 'success'

                newOrder.save((error, savedOrder) => {
                    console.log('requestService else---', error, savedOrder)

                    if (error) {
                        return secCallback(error, true)
                    }

                    var consumerMailMsg = "Your order for " + cartdata.cart_details.length + " products has been placed successfully and ₹ " + parseFloat(total_amount).toFixed(2) + " has been deducted from your registered Astrowize account. Thank you for shopping with us."
                    //to consumer
                    let mailConsumer = {
                        email: req.user.email,
                        subject: "AstroWize - Product order placed successfully!",
                        body:
                            "<p>" +
                            "Hello " + req.user.first_name + "," +
                            "<p>" +
                            consumerMailMsg +
                            "<p>" +
                            "Regards," +
                            "<br>" +
                            "Team AstroWize"
                    };
                    helper.sendEmail(mailConsumer);

                    //to consumer
                    var consumerMsg = "Order Order! Your order for " + cartdata.cart_details.length + " products has been placed successfully and ₹ " + parseFloat(total_amount).toFixed(2) + " has been deducted from your registered Astrowize wallet."
                    let consumerData = {
                        msg: consumerMsg,
                        title: "",
                        device_token: req.user.device_token,
                        data: {
                            message: consumerMsg,
                            flag: "Order Placed",
                            targetedScreen: 'order_history',
                            order_id: savedOrder._id
                        }
                    }
                    consumerData.data.user_id = req.user._id
                    notificationController.sendNotification(consumerData)

                    //sms to consumer
                    var consumerSmsMsg = "Your order for " + cartdata.cart_details.length + " products has been placed successfully and ₹ " + parseFloat(total_amount).toFixed(2) + " has been deducted from your registered AstroWize wallet. Thanks, FINOTO"
                    var smsConsumerData = {}
                    smsConsumerData.to = ['91' + req.user.mobile.replace(/\D/g, '')]
                    smsConsumerData.template_id = "1707160828893581771"
                    smsConsumerData.message = "Hello " + req.user.first_name + ",\n" + consumerSmsMsg
                    let smsConsumer = helper.sendSMS(smsConsumerData)

                    var data = new Object();
                    data = savedOrder.toObject({ getters: true })
                    data.payAmount = parseFloat(payAmount).toFixed(2)

                    cartdata.cart_details = [];
                    cartdata.save((err, savedData) => {
                        console.log('SET CART TO EMPTY ARRAY AND SAVED', err, savedData)
                        if (err) {
                        }
                    })

                    return secCallback(null, data)
                })
            }
        }
    ], function (err, savedOrder) {
        console.log('requestService funtion err -- ', err)
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }
        return res.status(200).json({
            title: res_title,
            error: false,
            data: savedOrder
        });
    })

}

/*
# parameters: token,
# purpose: List order
*/
const orderListing = async (req, res) => {
    console.log('orderListing req.body -- ', req.body);
    console.log('orderListing req.user---', req.user)

    let data = await productOrderModel.getOrders(req);

    let isData = data.length == 0 ? false : true

    return res.status(200).json({
        title: 'Order listing',
        error: false,
        data: isData ? data[0].data : [],
        total_count: isData ? data[0].totalCount : 0
    });
}

/*
# parameters: token,
# purpose: List order
*/
const orderDetails = async (req, res) => {
    console.log('orderDetails req.body -- ', req.body);

    const result = validationResult(req);

    console.log('orderDetails errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let orderData = await productOrderModel.getOrderById(req.body);

    if (!orderData) {
        return res.status(200).json({
            title: 'No order found',
            error: false
        });
    }
    return res.status(200).json({
        title: 'Order details',
        error: false,
        data: orderData
    });
}

/*
# parameters: token,
# purpose: List order
*/
const getNewOrderCount = async (req, res) => {
    console.log('getNewOrderCount req.body -- ', req.body);
    console.log('getNewOrderCount req.user---', req.user)

    let count = await productOrderModel.getNewOrdersCount(req);

    return res.status(200).json({
        title: 'New order count',
        error: false,
        total_count: count
    });
}

/*
# parameters: token,
# purpose: change order sttaus for admin
*/
const changeOrderStatus = async (req, res) => {
    console.log('changeOrderStatus req.body -- ', req.body);

    const result = validationResult(req);

    console.log('changeOrderStatus errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let orderData = await productOrderModel.getOrderById(req.body);

    if (!orderData) {
        return res.status(200).json({
            title: 'No order found',
            error: false
        });
    }
    orderData.current_status = 'Processed'
    let index = orderData.order_status.findIndex((e) => e.status == 'Processed')
    console.log('changeOrderStatus index---', index)
    if (index > -1) {

    }
    else {
        var status = orderData.order_status

        status.push({
            status: "Processed",
            description: "Order has been processed successfully",
            date: new Date()
        })
        console.log('changeOrderStatus status---', status)

        orderData.order_status = status
    }

    let invoiceName = await helper.generateLabel(orderData, req);
    console.log('\n\nInvoice Name :', invoiceName)
    orderData.invoice_name = invoiceName;

    orderData.save(async (error, savedOrder) => {
        console.log('changeOrderStatus error---', error)

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }

        // to consumer
        let consData = orderData.user_id

        var pushMsg = "Delivery time! Your order for " + orderData.products.length + " products is ready to dispatch. It will be delivered to you soon through a contactless delivery."
        var msg = "Your order for " + orderData.products.length + " products has been processed successfully. It will be delivered to you soon through a contactless delivery."

        let consumerData = {
            msg: pushMsg,
            title: "",
            device_token: consData.device_token,
            data: {
                message: pushMsg,
                flag: "Order Processed",
                order_id: orderData._id,
                targetedScreen: 'order_history',
            }
        }
        consumerData.data.user_id = orderData.user_id._id

        notificationController.sendNotification(consumerData)

        // sent mail to consumer
        let msgBody = "Your order for " + orderData.products.length + " products is ready to dispatch. It will be delivered to you soon. Our delivery executives follow all safety and precautionary measures."
        let mailData = {
            email: consData.email,
            subject: 'AstroWize - Product order status update!',
            body:
                "<p>" +
                "Hello " + orderData.user_id.first_name + "," +
                "<p>" +
                msgBody +
                "<p>" +
                "Explore more variety of gemstones on Astrowize app" +
                "<p>" +
                "Regards," +
                "<br>" +
                "Team AstroWize"
        };
        helper.sendEmail(mailData)

        let order_items_arr = [];
        orderData.products.forEach((product, i) => {
            let temp = {
                name: product.product_id.name,
                sku: 'gems',
                units: product.quantity,
                selling_price: product.rate,
                discount: 0
            }
            order_items_arr.push(temp);
        });

        let orderObj = {}
        orderObj.order_id = orderData.order_number
        orderObj.order_date = moment(orderData.createdAt).format("YYYY-MM-DD hh:mm")
        orderObj.pickup_location = 'astroad'
        orderObj.billing_customer_name = orderData.user_id.first_name
        orderObj.billing_last_name = " "
        orderObj.billing_address = `${orderData.user_address.block_number}, ${orderData.user_address.building_name}, ${orderData.user_address.street_address}`
        orderObj.billing_city = orderData.user_address.user_city
        orderObj.billing_pincode = orderData.user_address.pincode
        orderObj.billing_state = orderData.user_address.user_state
        orderObj.billing_country = 'India'
        orderObj.billing_email = orderData.user_id.email
        orderObj.billing_phone = orderData.user_id.mobile
        orderObj.shipping_is_billing = 1
        orderObj.order_items = order_items_arr
        orderObj.sub_total = req.body.total_amount
        orderObj.payment_method = 'Prepaid'
        orderObj.length = req.body.length
        orderObj.breadth = req.body.breadth
        orderObj.height = req.body.height
        orderObj.weight = req.body.weight

        console.log('\n\nSHIP ROCKET :-', orderObj);

        let data = await CourierService.reqgisterToShipRocket(orderObj)
        console.log('\n\nReqgisterToShipRocket :-', data);

        return res.status(200).json({
            title: 'Order processed successfully.',
            error: false,
            data: savedOrder
        });
    })
}

/*
# parameters: token,
# purpose: change order sttaus for admin
*/
const orderCallback = async (req, res) => {

    console.log('orderCallback req.body -- ', req.body);
    console.log('orderCallback payload -- ', req.body.payload);

    if (req.body.event == "payment.failed") {
        console.log('orderCallback payment acquirer_data -- ', req.body.payload.payment.entity.acquirer_data);
        console.log('orderCallback req.body.payload.payment.entity.id -- ', req.body.payload.payment.entity.id);

        let orderData = await productOrderModel.getOrderByQuery({ pay_order_id: req.body.payload.payment.entity.order_id });
        let reqData = await serviceReqModel.getRequestByRazorId({ pay_order_id: req.body.payload.payment.entity.order_id });
        let reqAcceptData = await serviceReqModel.getRequestByRazorId({ partial_order_id: req.body.payload.payment.entity.order_id });
        let userData = await userModel.getUserByRazorId({ pay_order_id: req.body.payload.payment.entity.order_id });
        //    let ratingData = await ratingModel.getRatingByRazorId({ pay_order_id: req.body.payload.payment.entity.order_id });

        var consData = ""
        var flag = ""

        var transData = new transModel({
            payment_status: "failed",
            transaction_amt: parseFloat(parseFloat(req.body.payload.payment.entity.amount) / 100).toFixed(2),
            client_transaction_amt: parseFloat(parseFloat(req.body.payload.payment.entity.amount) / 100).toFixed(2),
            payment_type: req.body.payload.payment.entity.method
        })
        if (orderData) {
            consData = orderData.user_id
            flag = "Order Failed"

            transData.transaction_type = 'product'
            transData.consumer_id = orderData.user_id._id
            transData.product_order_id = orderData._id
        }
        if (reqData) {
            consData = reqData.consumer_id
            flag = "Service Failed"

            transData.service_req_id = reqData._id
            transData.transaction_type = 'service'
            transData.consumer_id = reqData.consumer_id._id
            //    transData.astrologer_id = reqData.astrologer_id._id
            transData.pay_type = "first"
        }
        if (reqAcceptData) {
            consData = reqAcceptData.consumer_id
            flag = "Service Failed"

            transData.service_req_id = reqAcceptData._id
            transData.transaction_type = 'service'
            transData.consumer_id = reqAcceptData.consumer_id._id
            transData.astrologer_id = reqAcceptData.astrologer_id._id
            transData.pay_type = "second"
        }
        if (userData) {
            consData = userData
            flag = "Wallet Failed"

            transData.transaction_type = 'wallet'
            transData.consumer_id = userData._id
        }
        if (reqData) {
            consData = reqData.consumer_id
            flag = "Tip Failed"

            transData.transaction_type = 'tip'
            transData.consumer_id = reqData.consumer_id._id
            transData.astrologer_id = reqData.astrologer_id._id
        }

        transModel.saveTransaction(transData, (err, savedData) => {
            console.log('orderCallback failed saveTransaction---', err, savedData)
            if (err) {

            }
        })
        var msg = 'Transaction of amount ₹' + parseFloat(parseFloat(req.body.payload.payment.entity.amount) / 100).toFixed(2) + ' failed.'
        let consumerData = {
            msg: msg,
            title: "",
            device_token: consData.device_token,
            data: {
                message: msg,
                flag: flag
            }
        }
        consumerData.data.user_id = consData._id

        notificationController.sendNotification(consumerData)
    }
    if (req.body.event == "order.paid") {
        if (req.body && req.body.payload && req.body.payload.payment && req.body.payload.payment.entity) {

            console.log('orderCallback payment id -- ', req.body.payload.payment.entity.id);
            console.log('orderCallback notes -- ', req.body.payload.order.entity.notes);

            if (req.body.payload.order.entity.notes.order_type == "order") {

                let payemntData = await productOrderModel.getOrderByQuery({ pay_payment_id: req.body.payload.payment.entity.id });
                let orderData = await productOrderModel.getOrderByQuery({ pay_order_id: req.body.payload.order.entity.id });
                let cartdata = await cartModel.getCart(orderData.user_id);
                let userData = await userModel.getUserFromQuery({ _id: orderData.user_id._id });

                if (!payemntData && orderData) {
                    if (req.body.payload.order.entity.status == "paid") {

                        orderData.payment_status = "success"
                        orderData.pay_payment_id = req.body.payload.payment.entity.id
                        orderData.order_status = [{
                            status: "New",
                            description: "Order placed successfully",
                            date: new Date()
                        }],
                            orderData.current_status = "New"


                        var method = req.body.payload.payment.entity.method

                        if (req.body.payload.payment.entity.method == "wallet") {
                            method = req.body.payload.payment.entity.wallet
                        }

                        orderData.save((error, savedOrder) => {
                            console.log('orderCallback error---', error)

                            var transData = new transModel({
                                product_order_id: orderData._id,
                                transaction_type: 'product',
                                consumer_id: orderData.user_id._id,
                                payment_status: "success",
                                transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),//orderData.total_amount,
                                client_transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),//orderData.total_amount,
                                payment_type: method,
                                razor_fee: parseFloat(parseFloat(req.body.payload.payment.entity.fee) / 100).toFixed(2),
                                razor_tax: parseFloat(parseFloat(req.body.payload.payment.entity.tax) / 100).toFixed(2)
                            })

                            transModel.saveTransaction(transData, (err, savedData) => {
                                console.log('orderCallback saveTransaction---', err, transData)
                                if (err) {

                                }

                                //to consumer
                                let consData = orderData.user_id
                                var consumerMsg = "Order Order! Your order for " + orderData.products.length + " products has been placed successfully and ₹ " + orderData.total_amount + " has been deducted from your registered Astrowize wallet."
                                let consumerData = {
                                    msg: consumerMsg,
                                    title: "",
                                    device_token: consData.device_token,
                                    data: {
                                        message: consumerMsg,
                                        flag: "Order Placed",
                                        targetedScreen: 'order_history',
                                        order_id: orderData._id
                                    }
                                }
                                consumerData.data.user_id = orderData.user_id._id
                                notificationController.sendNotification(consumerData)

                                //sent mail to consumer
                                var consumerMailMsg = "Your order for " + orderData.products.length + " products has been placed successfully and ₹ " + orderData.total_amount + " has been deducted from your registered Astrowize account. Thank you for shopping with us."
                                let mailData = {
                                    email: consData.email,
                                    subject: 'AstroWize - Product order placed successfully!',
                                    body:
                                        "<p>" +
                                        "Hello " + consData.first_name + "," +
                                        "<p>" +
                                        consumerMailMsg +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };
                                helper.sendEmail(mailData)

                                //sms to consumer
                                var consumerSmsMsg = "Your order for " + orderData.products.length + " products has been placed successfully and ₹ " + orderData.total_amount + " has been deducted from your registered Astrowize wallet. Thanks, FINOTO"
                                var smsConsumerData = {}
                                smsConsumerData.to = ['91' + consData.mobile.replace(/\D/g, '')]
                                smsConsumerData.template_id = "e61b72c9-d6ce-4ee1-ac1b-51bd76862bd3"
                                smsConsumerData.message = "Hello " + consData.first_name + ",\n" + consumerSmsMsg
                                let smsConsumer = helper.sendSMS(smsConsumerData)

                                //sent mail to admin
                                let adminMsgBody = "New order received from " + consData.first_name
                                let adminMailData = {
                                    email: process.env.mail_username,
                                    subject: 'New Order',
                                    body:
                                        '<p>' + adminMsgBody
                                };
                                helper.sendEmail(adminMailData)

                                cartdata.cart_details = [];
                                cartdata.save((err, savedData) => {
                                    console.log('SET CART TO EMPTY ARRAY AND SAVED', err, savedData)
                                    if (err) {
                                    }
                                })

                                if (req.body.payload.order.entity.notes.use_wallet == true || req.body.payload.order.entity.notes.use_wallet == 'true') {

                                    let wallet_amt_used = parseFloat(req.body.payload.order.entity.notes.wallet_amt_used).toFixed(2);
                                    orderData.user_id.wallet_balance = orderData.user_id.wallet_balance - wallet_amt_used;
                                    orderData.user_id.save((err, savedData) => {
                                        console.log('SET WALLET BALANCE AS PER USED BY USER FOR PART OF THE PAYMENT', err, savedData)
                                        if (err) {
                                        }
                                        else {

                                            let transData = new transModel({
                                                transaction_type: 'product',
                                                product_order_id: orderData._id,
                                                consumer_id: orderData.user_id._id,
                                                payment_status: 'success',
                                                payment_type: 'wallet',
                                                transaction_amt: wallet_amt_used,
                                                client_transaction_amt: wallet_amt_used
                                            })

                                            transModel.saveTransaction(transData, (err, savedData) => {
                                                console.log('SAVE TRANSACTION FOR WALLET AMOUNT', err, savedData)
                                                if (err) {
                                                }
                                            })

                                        }
                                    })

                                }
                            })

                        })
                    }
                }

            }
            if (req.body.payload.order.entity.notes.order_type == "service") {
                let payemntData = await serviceReqModel.getRequestByRazorId({ pay_payment_id: req.body.payload.payment.entity.id });
                let reqData = await serviceReqModel.getRequestByRazorId({ pay_order_id: req.body.payload.order.entity.id });
                if (!payemntData && reqData) {
                    if (req.body.payload.order.entity.status == "paid") {
                        reqData.payment_status = "success"
                        reqData.pay_payment_id = req.body.payload.payment.entity.id
                        reqData.service_status = "New"

                        var method = req.body.payload.payment.entity.method
                        if (req.body.payload.payment.entity.method == "wallet") {
                            method = req.body.payload.payment.entity.wallet
                        }
                        reqData.save((error, savedReq) => {
                            console.log('orderCallback service error---', error)
                            var transData = new transModel({
                                service_req_id: reqData._id,
                                transaction_type: 'service',
                                consumer_id: reqData.consumer_id._id,
                                //    astrologer_id: reqData.astrologer_id._id,
                                payment_status: "success",
                                transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                client_transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                payment_type: method,
                                pay_type: "first",
                                razor_fee: parseFloat(parseFloat(req.body.payload.payment.entity.fee) / 100).toFixed(2),
                                razor_tax: parseFloat(parseFloat(req.body.payload.payment.entity.tax) / 100).toFixed(2)
                            })

                            transModel.saveTransaction(transData, (err, savedData) => {
                                console.log('orderCallback service saveTransaction---', err, savedData)
                                if (err) {

                                }

                                //to consumer
                                let consData = reqData.consumer_id
                                var msg = "We're at your service! Your service request for " + reqData.service_id.name + " has been placed successfully and ₹ " + (parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2) + " has been deducted from your registered Astrowize wallet."
                                let consumerData = {
                                    msg: msg,
                                    title: "",
                                    device_token: consData.device_token,
                                    data: {
                                        message: msg,
                                        flag: "Service Requested",
                                        request_id: reqData._id,
                                        targetedScreen: "service_list"
                                    }
                                }
                                consumerData.data.user_id = consData._id

                                //sent mail to consumer
                                let mailData = {
                                    email: consData.email,
                                    subject: 'AstroWize - Service request placed successfully!',
                                    body:
                                        "<p>" +
                                        "Hello " + consData.first_name + "," +
                                        "<p>" +
                                        "Your service request for " + reqData.service_id.name + " has been placed successfully and ₹ " + (parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2) + " has been deducted from your registered Astrowize wallet." +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };
                                helper.sendEmail(mailData)

                                //sms to consumer
                                var smsData = {}
                                smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
                                smsData.template_id = "1707160828903322300"
                                smsData.message = "Hello " + consData.first_name + ",\n Your service request for " + reqData.service_id.name + " has been placed successfully and ₹ " + (parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2) + " has been deducted from your registered AstroWize wallet. Thanks, FINOTO."
                                let sms = helper.sendSMS(smsData)

                                notificationController.sendNotification(consumerData)

                                if (req.body.payload.order.entity.notes.use_wallet == true || req.body.payload.order.entity.notes.use_wallet == 'true') {

                                    let wallet_amt_used = parseFloat(req.body.payload.order.entity.notes.wallet_amt_used).toFixed(2);
                                    reqData.consumer_id.wallet_balance = reqData.consumer_id.wallet_balance - wallet_amt_used;
                                    reqData.consumer_id.save((err, savedData) => {
                                        console.log('SET WALLET BALANCE for service payemnt', err, savedData)
                                        if (err) {
                                        }
                                        else {
                                            let transData = new transModel({
                                                service_req_id: reqData._id,
                                                transaction_type: 'service',
                                                consumer_id: reqData.consumer_id._id,
                                                payment_status: "success",
                                                payment_type: "wallet",
                                                pay_type: "first",
                                                transaction_amt: wallet_amt_used,
                                                client_transaction_amt: wallet_amt_used
                                            })

                                            transModel.saveTransaction(transData, (err, savedData) => {
                                                console.log('SAVE TRANSACTION FOR service AMOUNT', err, savedData)
                                                if (err) {
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        })
                    }
                }
            }
            if (req.body.payload.order.entity.notes.order_type == "service_accept") {

                let payemntData = await serviceReqModel.getRequestByRazorId({ partial_payment_id: req.body.payload.payment.entity.id });
                let reqData = await serviceReqModel.getRequestByRazorId({ partial_order_id: req.body.payload.order.entity.id });
                let serviceReqSessions = await chatSessionModel.getSessionByServiceReqId(reqData);

                console.log('orderCallback service-partial payemntData---', payemntData, reqData)

                if (!payemntData && reqData) {
                    if (req.body.payload.order.entity.status == "paid") {

                        // CANCEL AND DELETE SERVICE PAYMENT NOTIFICATION SCHEDULERS
                        serviceReqSessions.forEach((session, i) => {
                            let myScheduleJob = nodeSchedule.scheduledJobs[session.schedule_name];
                            if (myScheduleJob != undefined) {
                                myScheduleJob.cancel();
                            }
                        });

                        chatSessionModel.deleteMany({ service_req_id: reqData._id }, (error, data) => {
                            console.log('twelveEndSession deleteMany ', error, data);
                        });

                        reqData.payment_status = "success"
                        reqData.partial_payment_id = req.body.payload.payment.entity.id

                        //otp for completing service
                        var otp = randomstring.generate({
                            length: 4,
                            charset: 'numeric'
                        });
                        console.log("orderCallback service_accept otp", otp)

                        reqData.service_status = "Scheduled"
                        reqData.otp = otp

                        var method = req.body.payload.payment.entity.method
                        if (req.body.payload.payment.entity.method == "wallet") {
                            method = req.body.payload.payment.entity.wallet
                        }
                        reqData.save((error, savedReq) => {
                            console.log('orderCallback service-partial error---', error)
                            var transData = new transModel({
                                service_req_id: reqData._id,
                                transaction_type: 'service',
                                consumer_id: reqData.consumer_id._id,
                                astrologer_id: reqData.astrologer_id._id,
                                payment_status: "success",
                                transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                client_transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                payment_type: method,
                                pay_type: "second",
                                razor_fee: parseFloat(parseFloat(req.body.payload.payment.entity.fee) / 100).toFixed(2),
                                razor_tax: parseFloat(parseFloat(req.body.payload.payment.entity.tax) / 100).toFixed(2)
                            })

                            transModel.saveTransaction(transData, (err, savedData) => {
                                console.log('orderCallback service-partial saveTransaction---', err, savedData)
                                if (err) {

                                }

                                var serviceTime = moment.tz(reqData.service_time, helper.getTimezone()).format('MMM DD, YYYY hh:mm a')

                                //send mail to astrologer                                
                                let mailAstrologer = {
                                    email: reqData.astrologer_id.email,
                                    subject: 'Service Scheduled',
                                    body:
                                        "<p>" +
                                        "Hello " + reqData.astrologer_id.first_name + "," +
                                        "<p>" +
                                        "A service request for " + reqData.service_id.name + " has been assigned to you at " + reqData.consumer_id.first_name + "'s place at " + serviceTime + ". To accept, head over to Astrowize app. Thank you." +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };
                                helper.sendEmail(mailAstrologer);

                                //to astrologer
                                var astrologerMsg = "Seva ka waqt! You have received a service request. Click here to know more."
                                let astrologerData = {
                                    msg: astrologerMsg,
                                    title: "",
                                    device_token: reqData.astrologer_id.device_token,
                                    data: {
                                        message: astrologerMsg,
                                        flag: "Service Scheduled",
                                        targetedScreen: "service_list"
                                    }
                                }
                                astrologerData.data.user_id = reqData.astrologer_id._id
                                astrologerData.data.sec_user_id = reqData.consumer_id._id

                                notificationController.sendNotification(astrologerData)

                                //sms to astrologer
                                var astrologerSmsMsg = "A service request for " + reqData.service_id.name + " has been assigned to you at " + reqData.consumer_id.first_name + "'s place at " + serviceTime + ". To accept, head over to AstroWize app. Thanks, FINOTO."
                                var smsData = {}
                                smsData.to = ['91' + reqData.astrologer_id.mobile.replace(/\D/g, '')]
                                smsData.template_id = "1707160828912009816"
                                smsData.message = "Hello " + reqData.astrologer_id.first_name + ",\n\n" + astrologerSmsMsg
                                let sms = helper.sendSMS(smsData)

                                //to consumer
                                let consData = reqData.consumer_id
                                var msg = "Your service request for " + reqData.service_id.name + " has been confirmed and " + reqData.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + ". Our Astrologers follow all safety and precautionary measures."
                                let consumerData = {
                                    msg: msg,
                                    title: "",
                                    device_token: consData.device_token,
                                    data: {
                                        message: msg,
                                        flag: "Service Scheduled",
                                        targetedScreen: "service_list",
                                        request_id: reqData._id
                                    }
                                }
                                consumerData.data.user_id = consData._id

                                //sent mail to consumer
                                let msgBody = "Your service request for " + reqData.service_id.name + " has been confirmed and " + reqData.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + ". Our astrologers follow all safety and precautionary measures." +
                                    "<p>" +
                                    "Thank you for using our services."

                                let mailData = {
                                    email: consData.email,
                                    subject: 'Service Scheduled',
                                    body:
                                        "<p>" +
                                        "Hello " + reqData.consumer_id.first_name + "," +
                                        "<p>" +
                                        msgBody +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };
                                helper.sendEmail(mailData)

                                //sms
                                var consumerSmsMsg = "Your service request for " + reqData.service_id.name + " has been confirmed and " + reqData.astrologer_id.first_name + " will be arriving at your place at " + serviceTime + ". Our astrologers follow all safety and precautionary measures. Thank you for using our services, FINOTO."
                                var smsData = {}
                                smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
                                smsData.template_id = "1707160829012518301"
                                smsData.message = "Hello " + consData.first_name + ",\n" + consumerSmsMsg
                                let smsConsumer = helper.sendSMS(smsData)

                                notificationController.sendNotification(consumerData)

                                if (req.body.payload.order.entity.notes.use_wallet == true || req.body.payload.order.entity.notes.use_wallet == 'true') {

                                    let wallet_amt_used = parseFloat(req.body.payload.order.entity.notes.wallet_amt_used).toFixed(2);
                                    reqData.consumer_id.wallet_balance = reqData.consumer_id.wallet_balance - wallet_amt_used;
                                    reqData.consumer_id.save((err, savedData) => {
                                        console.log('SET WALLET BALANCE for service second', err, savedData)
                                        if (err) {
                                        }
                                        else {
                                            let transData = new transModel({
                                                service_req_id: reqData._id,
                                                transaction_type: 'service',
                                                consumer_id: reqData.consumer_id._id,
                                                astrologer_id: reqData.astrologer_id._id,
                                                payment_status: "success",
                                                payment_type: "wallet",
                                                pay_type: "second",
                                                transaction_amt: wallet_amt_used,
                                                client_transaction_amt: wallet_amt_used
                                            })

                                            transModel.saveTransaction(transData, (err, savedData) => {
                                                console.log('SAVE TRANSACTION FOR service second', err, savedData)
                                                if (err) {
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        })
                    }
                }
            }
            if (req.body.payload.order.entity.notes.order_type == "wallet") {
                let payemntData = await userModel.getUserByRazorId({ pay_payment_id: req.body.payload.payment.entity.id });
                let userData = await userModel.getUserByRazorId({ pay_order_id: req.body.payload.order.entity.id });
                if (!payemntData && userData) {
                    if (req.body.payload.order.entity.status == "paid") {

                        userData.pay_payment_id = req.body.payload.payment.entity.id
                        let wallet = parseFloat(userData.wallet_balance) + parseFloat(req.body.payload.order.entity.amount) / 100

                        let offerData = await offerModel.findOne({ type: 'double' }).then(result => result)

                        // OFFER
                        if (offerData && offerData.type == 'double' && offerData.isActive == true) {
                            console.log('\n\n\n\n\nDOUBLE DHAMAKA OFFER (BEFORE) 1 :', wallet, '\n\n\n\n\n');
                            wallet = parseFloat(userData.wallet_balance) + (parseFloat(req.body.payload.order.entity.amount) * 2) / 100
                            console.log('\n\n\n\n\nDOUBLE DHAMAKA OFFER (AFTER) 2 :', wallet, '\n\n\n\n\n');
                        }

                        userData.wallet_balance = parseFloat(wallet).toFixed(2)

                        var method = req.body.payload.payment.entity.method

                        if (req.body.payload.payment.entity.method == "wallet") {
                            method = req.body.payload.payment.entity.wallet
                        }

                        userData.save((error, savedUser) => {
                            console.log('orderCallback wallet error---', error)

                            var transData = new transModel({
                                transaction_type: 'wallet',
                                consumer_id: userData._id,
                                payment_status: "success",
                                transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                client_transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                payment_type: method,
                                razor_fee: parseFloat(parseFloat(req.body.payload.payment.entity.fee) / 100).toFixed(2),
                                razor_tax: parseFloat(parseFloat(req.body.payload.payment.entity.tax) / 100).toFixed(2)
                            })

                            transModel.saveTransaction(transData, (err1, saved) => {
                                console.log('orderCallback deposit saveTransaction---', err1, saved)
                                if (err1) {

                                }

                                var transData = new transModel({
                                    transaction_type: 'deposit',
                                    consumer_id: userData._id,
                                    payment_status: "success",
                                    transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                    client_transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                    payment_type: method,
                                    razor_fee: parseFloat(parseFloat(req.body.payload.payment.entity.fee) / 100).toFixed(2),
                                    razor_tax: parseFloat(parseFloat(req.body.payload.payment.entity.tax) / 100).toFixed(2)
                                })

                                // transModel.saveTransaction(transData, (err, savedData) => {
                                //     console.log('orderCallback wallet saveTransaction---', err, savedData)
                                //     if (err) {

                                //     }

                                    if (offerData && offerData.type == 'double' && offerData.isActive == true) {
                                        console.log('\n\n\n\n\nDOUBLE DHAMAKA OFFER 3: SAVE TRANSACTION\n\n\n\n\n');
                                        let transData = new transModel({
                                            byAdmin: true,
                                            transaction_type: 'wallet',
                                            consumer_id: userData._id,
                                            payment_status: 'success',
                                            transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                            client_transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                            payment_type: method,
                                            razor_fee: parseFloat(parseFloat(req.body.payload.payment.entity.fee) / 100).toFixed(2),
                                            razor_tax: parseFloat(parseFloat(req.body.payload.payment.entity.tax) / 100).toFixed(2)
                                        })
                                        transModel.saveTransaction(transData, (err, savedData) => {
                                            console.log('orderCallback wallet saveTransaction---', err, savedData)
                                            if (err) { }
                                            console.log('\n\n\n\n\nDOUBLE DHAMAKA OFFER 4: SAVE TRANSACTION SUCCESS\n\n\n\n\n');
                                        })
                                    }

                                    //to consumer
                                    let consData = userData
                                    var msg = "Top it up! Top up of ₹ " + parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2) + " has been added to your Astrowize wallet successfully. Your current balance is ₹ " + userData.wallet_balance + "."
                                    let consumerData = {
                                        msg: msg,

                                        title: "",
                                        device_token: consData.device_token,
                                        data: {
                                            targetedScreen: 'wallet_screen',
                                            message: msg,
                                            flag: "Wallet Topup"
                                        }
                                    }
                                    consumerData.data.user_id = userData._id
                                    notificationController.sendNotification(consumerData)

                                    //sent mail to consumer
                                    let mailData = {
                                        email: consData.email,
                                        subject: 'AstroWize - Wallet top up successful!',
                                        body:
                                            "<p>" +
                                            "Hello " + consData.first_name + "," +
                                            "<p>" +
                                            "This is to inform you that top up of ₹ " + parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2) + " has been added to your Astrowize wallet successfully." +
                                            "<p>" +
                                            "Your current wallet balance is ₹ " + userData.wallet_balance + "." +
                                            "<p>" +
                                            "Regards," +
                                            "<br>" +
                                            "Team AstroWize"
                                    };
                                    helper.sendEmail(mailData)

                                    //sms
                                    var smsData = {}
                                    smsData.to = ['91' + userData.mobile.replace(/\D/g, '')]
                                    smsData.template_id = "1707160828942466842"
                                    smsData.message = "Hello " + userData.first_name + ",\n" + "The top up of ₹ " + parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2) + " has been successfully added to your AstroWize wallet. Your current wallet balance is ₹ " + userData.wallet_balance + ". Thanks, FINOTO."
                                    let sms = helper.sendSMS(smsData)

                                // })
                            })
                        })
                    }
                }
            }
            if (req.body.payload.order.entity.notes.order_type == "tip") {
                // let payemntData = await ratingModel.getRatingByRazorId({ pay_payment_id: req.body.payload.payment.entity.id });
                // let ratingData = await ratingModel.getRatingByRazorId({ pay_order_id: req.body.payload.order.entity.id });

                let payemntData = await serviceReqModel.getRequestByRazorId({ pay_payment_id: req.body.payload.payment.entity.id });
                let reqData = await serviceReqModel.getRequestByRazorId({ pay_order_id: req.body.payload.order.entity.id });

                console.log('orderCallback tip payemntData---', payemntData)
                console.log('orderCallback tip reqData---', reqData)
                if (!payemntData && reqData) {
                    if (req.body.payload.order.entity.status == "paid") {
                        reqData.pay_payment_id = req.body.payload.payment.entity.id

                        var method = req.body.payload.payment.entity.method
                        if (req.body.payload.payment.entity.method == "wallet") {
                            method = req.body.payload.payment.entity.wallet
                        }

                        reqData.save((error, savedReq) => {
                            console.log('orderCallback tip error---', error)

                            var transData = new transModel({
                                transaction_type: 'tip',
                                consumer_id: reqData.consumer_id._id,
                                astrologer_id: reqData.astrologer_id._id,
                                service_req_id: reqData._id,
                                payment_status: "success",
                                transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                client_transaction_amt: parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2),
                                payment_type: method,
                                razor_fee: parseFloat(parseFloat(req.body.payload.payment.entity.fee) / 100).toFixed(2),
                                razor_tax: parseFloat(parseFloat(req.body.payload.payment.entity.tax) / 100).toFixed(2)
                            })

                            transModel.saveTransaction(transData, (err, savedData) => {
                                console.log('orderCallback tip saveTransaction---', err, savedData)
                                if (err) {

                                }

                                //send mail to astrologer
                                var astrologerMail = 'A generous consumer has paid a tip above your fees. Head over to Astrowize app to know who it is. Thank you for your valuable services.'

                                let mailAstrologer = {
                                    email: reqData.astrologer_id.email,
                                    subject: 'Guru Dakshina',
                                    body:
                                        "<p>" +
                                        "Hello " + reqData.astrologer_id.first_name + "," +
                                        "<p>" +
                                        astrologerMail +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };
                                helper.sendEmail(mailAstrologer);

                                var astrologerMsg = 'Tip of the day! A generous consumer has paid you a tip above your fees! Click here to know who.'
                                //to astrologer
                                let astrologerData = {
                                    msg: astrologerMsg,
                                    title: "",
                                    device_token: reqData.astrologer_id.device_token,
                                    data: {
                                        message: astrologerMsg,
                                        flag: "Guru Dakshina",
                                        targetedScreen: "service_list"
                                    }
                                }
                                astrologerData.data.user_id = reqData.astrologer_id._id
                                astrologerData.data.sec_user_id = reqData.consumer_id._id

                                notificationController.sendNotification(astrologerData)

                                //sms to astrologer
                                var smsMsg = 'A generous consumer has paid a tip above your fees. Head over to AstroWize app to know who it is. Thank you for your valuable services, FINOTO.'
                                var smsData = {}
                                smsData.to = ['91' + reqData.astrologer_id.mobile.replace(/\D/g, '')]
                                smsData.message = "Hello " + reqData.astrologer_id.first_name + ",\n" + smsMsg
                                let sms = helper.sendSMS(smsData)

                                var transAmount = parseFloat(parseFloat(req.body.payload.order.entity.amount) / 100).toFixed(2)
                                if (req.body.payload.order.entity.notes.use_wallet == true || req.body.payload.order.entity.notes.use_wallet == 'true') {
                                    console.log('orderCallback tip use_wallet', req.body.payload.order.entity.notes.use_wallet)

                                    let wallet_amt_used = Number(req.body.payload.order.entity.notes.wallet_amt_used)
                                    console.log('orderCallback tip wallet_amt_used', wallet_amt_used)

                                    reqData.consumer_id.wallet_balance = Number(reqData.consumer_id.wallet_balance) - wallet_amt_used;

                                    console.log('orderCallback tip reqData.consumer_id.wallet_balance', reqData.consumer_id.wallet_balance)

                                    transAmount = Number(transAmount) + wallet_amt_used
                                    console.log('orderCallback tip transAmount', transAmount)

                                    reqData.consumer_id.save((err, savedData) => {
                                        console.log('SET WALLET BALANCE for service tip', err, savedData)
                                        if (err) {
                                        }
                                        else {
                                            let transData = new transModel({
                                                transaction_type: 'tip',
                                                consumer_id: reqData.consumer_id._id,
                                                astrologer_id: reqData.astrologer_id._id,
                                                service_req_id: reqData._id,
                                                payment_status: "success",
                                                payment_type: "wallet",
                                                pay_type: "second",
                                                transaction_amt: wallet_amt_used,
                                                client_transaction_amt: wallet_amt_used
                                            })

                                            transModel.saveTransaction(transData, (err, savedData) => {
                                                console.log('SAVE TRANSACTION FOR service tip', err, savedData)
                                                if (err) {
                                                }
                                            })
                                        }
                                    })
                                }

                                serviceReqModel
                                    .findOneAndUpdate({ '_id': reqData._id },
                                        { $set: { "tip": transAmount } }, { new: true, useFindAndModify: false })
                                    .exec((err, data) => {
                                        console.log('orderCallback findOneAndUpdate err ', err);
                                        console.log('orderCallback findOneAndUpdate data ', data);
                                    })

                                //to consumer
                                let consData = reqData.consumer_id
                                var msg = "Guru Dakshina! This is to inform you that tip of ₹ " + transAmount + " was successfully paid to " + reqData.astrologer_id.first_name + " from your Astrowize wallet."
                                let consumerData = {
                                    msg: msg,
                                    title: "",
                                    device_token: consData.device_token,
                                    data: {
                                        message: msg,
                                        flag: "Guru Dakshina",
                                        targetedScreen: "earning_list"
                                    }
                                }
                                consumerData.data.user_id = reqData.consumer_id._id
                                notificationController.sendNotification(consumerData)

                                //send mail to consumer
                                var consumerMailMsg = "This is to inform you that tip of  ₹ " + transAmount + " was successfully paid to " + reqData.astrologer_id.first_name + " from your Astrowize wallet."
                                let mailConsumer = {
                                    email: consData.email,
                                    subject: "Guru Dakshina",
                                    body:
                                        "<p>" +
                                        "Hello " + consData.first_name + "," +
                                        "<p>" +
                                        consumerMailMsg +
                                        "<p>" +
                                        "Regards," +
                                        "<br>" +
                                        "Team AstroWize"
                                };
                                helper.sendEmail(mailConsumer);

                                //sms to consumer
                                var smsConsumerMsg = "This is to inform you that tip of  ₹ " + transAmount + " was successfully paid to " + reqData.astrologer_id.first_name + " from your AstroWize wallet. Thanks, FINOTO."
                                var smsData = {}
                                smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
                                smsData.template_id = "1707160828977833101"
                                smsData.message = "Hello " + consData.first_name + ",\n" + smsConsumerMsg
                                let smsAstrologer = helper.sendSMS(smsData)
                            })
                        })
                    }
                }
            }

        }
    }
    res.sendStatus(200)
}

/*
# parameters: token,
# purpose: change order sttaus for admin
*/
const cancelProductOrder = async (req, res) => {
    console.log('cancelProductOrder req.body -- ', req.body);
    console.log('\n\n\n\n\n\n\n\nCancelProductOrder req.body -- ', req.user);

    const result = validationResult(req);

    console.log('cancelProductOrder errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    let orderData = await productOrderModel.getOrderById(req.body);

    if (!orderData) {
        return res.status(200).json({
            title: 'No order found',
            error: false
        });
    }
    if (orderData.current_status == "Cancelled") {
        return res.status(200).json({
            title: 'You already cancelled this order',
            error: true,
        });
    }

    console.log('cancelProductOrder orderData ', orderData);

    orderData.current_status = "Cancelled"

    var status = orderData.order_status
    status.push({
        status: "Cancelled",
        description: "Order has been cancelled successfully",
        date: new Date()
    })
    console.log('cancelProductOrder status---', status)

    orderData.order_status = status
    orderData.save((error, savedOrder) => {
        console.log('cancelProductOrder error---', error)

        if (error) {
            return res.status(200).json({
                title: 'Something went wrong, Please try again..',
                error: true,
            });
        }

        //refund to wallet
        let wallet_balance = parseFloat(orderData.user_id.wallet_balance + savedOrder.total_amount).toFixed(2)
        console.log('cancelProductOrder wallet_balance---', orderData.user_id.wallet_balance, '---', wallet_balance)

        let consData = orderData.user_id
        consData.wallet_balance = wallet_balance

        consData.save((error, savedUser) => {
            console.log('cancelProductOrder savedUser---', error, savedUser)

            if (error) {
                return res.status(200).json({
                    title: 'Something went wrong, Please try again..',
                    error: true,
                });
            }

            //to consumer        

            var pushMsg = "Oops! Your order for " + orderData.products.length + " products has been cancelled and ₹ " + parseFloat(savedOrder.total_amount).toFixed(2) + " has been restored in your Astrowize wallet."//'Order cancelled successfully.'
            if (req.user.user_type == 'admin') {
                pushMsg = "Oops! Your order for " + orderData.products.length + " products has been cancelled by admin and ₹ " + parseFloat(savedOrder.total_amount).toFixed(2) + " has been restored in your Astrowize wallet."//'Order cancelled successfully.'
            }

            let consumerData = {
                msg: pushMsg,
                title: "",
                device_token: consData.device_token,
                data: {
                    message: pushMsg,
                    flag: "Order Cancelled",
                    targetedScreen: 'order_history',
                    order_id: orderData._id
                }
            }
            consumerData.data.user_id = orderData.user_id._id

            notificationController.sendNotification(consumerData)

            //sent mail to consumer

            let msgBody = "Your order for " + orderData.products.length + " products has been cancelled and ₹ " + parseFloat(savedOrder.total_amount).toFixed(2) + " has been restored in your Astrowize wallet."
            if (req.user.user_type == 'admin') {
                msgBody = "Your order for " + orderData.products.length + " products has been cancelled by admin and ₹ " + parseFloat(savedOrder.total_amount).toFixed(2) + " has been restored in your Astrowize wallet."
            }

            let mailData = {
                email: consData.email,
                subject: 'AstroWize - Product order cancelled!',
                body:
                    "<p>" +
                    "Hello " + orderData.user_id.first_name + "," +
                    "<p>" +
                    msgBody +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData)

            //sms
            var consumerSmsMsg = "Hello " + orderData.user_id.first_name + ". " + "Your order for " + orderData.products.length + " products has been cancelled and ₹ " + parseFloat(savedOrder.total_amount).toFixed(2) + " has been restored in your AstroWize wallet. Thanks, FINOTO."
            if (req.user.user_type == 'admin') {
                var consumerSmsMsg = "Hello " + orderData.user_id.first_name + ". " + "Your order for " + orderData.products.length + " products has been cancelled by admin and ₹ " + parseFloat(savedOrder.total_amount).toFixed(2) + " has been restored in your AstroWize wallet. Thanks, FINOTO."
            }

            var smsData = {}
            smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
            smsData.template_id = "1707160828950232867"
            smsData.message = "Hello " + consData.first_name + ",\n" + consumerSmsMsg

            let sms = helper.sendSMS(smsData)

            //sent mail to admin
            let adminMsgBody = "A product order of " + orderData.products.length + " worth ₹ " + parseFloat(savedOrder.total_amount).toFixed(2) + " has been cancelled by " + consData.first_name + ". Please do not proceed ahead with the order. "
            let adminMailData = {
                email: process.env.mail_username,
                subject: 'Call Request',
                body:
                    "<p>" +
                    "Hello Admin," +
                    "<p>" +
                    adminMsgBody +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(adminMailData)

            //to save transaction
            var transData = new transModel({
                transaction_type: 'product',
                consumer_id: orderData.user_id._id,
                product_order_id: orderData._id,
                payment_status: "success",
                payment_type: "wallet",
                pay_type: "refund",
                transaction_amt: savedOrder.total_amount,
                client_transaction_amt: savedOrder.total_amount,
                byAdmin: req.user.user_type == 'admin' ? true : false
            })
            transModel.saveTransaction(transData, (err, savedData) => {
                console.log('jobSeeker in events savedData', err, savedData);

                if (err) {
                    return res.status(200).json({
                        title: 'Something went wrong, Please try again..',
                        error: true,
                    });
                }
                return res.status(200).json({
                    title: 'Order cancelled successfully',
                    error: false,
                    data: savedOrder
                });
            })
        })
    })
}

const shipRocketWebhook = async (req, res) => {

    console.log('\n\nSHIP ROCKET WEBHOOK', JSON.stringify(req.body));

    const result = validationResult(req);

    if (result && result.errors && result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    if (req.body.fromAdmin == true && req.body.otp != req.user.otp) {
        return res.status(200).json({
            error: true,
            title: 'Entered OTP is incorrect',
        });
    }

    let orderData = await productOrderModel.getOrderByQuery({ order_number: req.body.order_id });

    if (orderData) {

        let status = orderData.order_status;

        status.push({
            status: req.body.current_status,
            date: req.body.fromAdmin ? new Date() : req.body.scans[0].date,
            description: req.body.fromAdmin ? 'Order delivered successfully' : req.body.scans[0].activity,
        })

        if (req.body.current_status == 'Delivered') {

            orderData.current_status = 'Delivered';

            let consData = orderData.user_id;

            // PUSH NOTIFICATION
            var pushMsg = "Voila! Your order for " + orderData.products.length + " products has been delivered at your doorstep"
            let consumerData = {
                msg: pushMsg,
                title: "",
                device_token: consData.device_token,
                data: {
                    message: pushMsg,
                    flag: "Order Processed",
                    order_id: orderData._id,
                    targetedScreen: 'order_history',
                }
            }

            consumerData.data.user_id = consData._id
            notificationController.sendNotification(consumerData)

            // EMAIL
            let msgBody = "This is to inform you that your order for " + orderData.products.length + " products has been delivered!"
            let mailData = {
                email: consData.email,
                subject: 'AstroWize - Product delivered!',
                body:
                    "<p>" +
                    "Hello " + consData.first_name + "," +
                    "<p>" +
                    msgBody +
                    "<p>" +
                    "Hope you had a great experience!" +
                    "<p>" +
                    "Regards," +
                    "<br>" +
                    "Team AstroWize"
            };
            helper.sendEmail(mailData)

            // SMS
            var consumerSmsMsg = "Hello " + consData.first_name + ". " + "Your order for " + orderData.products.length + " products has been delivered at your doorstep. Thank you for shopping with us."
            var smsData = {}
            smsData.to = ['91' + consData.mobile.replace(/\D/g, '')]
            smsData.template_id = "bbbe2b7a-c85e-4066-97d3-36e078ca739a"
            smsData.message = "Hello " + consData.first_name + ",\n" + consumerSmsMsg
            let sms = helper.sendSMS(smsData)

        }

        orderData.order_status = status;
        orderData.save((error, savedOrder) => {
            console.log('orderData.save', error, savedOrder);
        })
    }

    if (req.body.fromAdmin == true && req.body.otp == req.user.otp) {

        req.user.otp = ''
        req.user.otp_expired = '';

        req.user.save((error, savedUser) => {
            if (error) {
                return res.status(200).json({
                    error: true,
                    title: 'Failure',
                });
            }
        })
    }

    res.sendStatus(200)

}

const generateDeliveredOtp = async (req, res) => {
    console.log('\n\n\n\nGenerateDeliveredOtp', req.user);

    if (req.user.user_type != 'admin') {
        return res.status(200).json({
            error: true,
            title: 'Failure',
        });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);

    req.user.otp = otp;
    req.user.otp_expired = Date.now() + 600000;

    req.user.save((error, savedUser) => {
        if (error) {
            return res.status(200).json({
                error: true,
                title: 'Failure',
            });
        }

        let mailData = {
            email: req.user.email,
            subject: 'Mark Order Delivered OTP',
            body:
                '<p>' +
                'Hello ' +
                '<p>' +
                'Your OTP to mark order as delivered is: ' + otp +
                '<p>' +
                'Regards,' +
                '<br>' +
                'Team AstroWize'
        };

        helper.sendEmail(mailData);

        let smsData = {}
        smsData.to = ['91' + req.user.mobile.replace(/\D/g, '')]
        smsData.template_id = '1707160828950232867'
        smsData.message = `Your Astrowize OTP is ${otp} and is valid for 10min.`

        let sms = helper.sendSMS(smsData)

        return res.status(200).json({
            error: false,
            title: 'OTP sent successfully',
        });

    })
}

module.exports = {
    createOrder,
    orderListing,
    orderDetails,
    getNewOrderCount,
    changeOrderStatus,
    orderCallback,
    cancelProductOrder,
    shipRocketWebhook,
    generateDeliveredOtp
}