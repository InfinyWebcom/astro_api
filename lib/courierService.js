const axios = require('axios')
const async = require('async');
const request = require('request');

/* Model */
const productOrderModel = require('../models/productOrder');

const shipRocketLogin = () => {
    return axios({
        method: 'post',
        url: 'https://apiv2.shiprocket.in/v1/external/auth/login',
        header: 'Content-Type: application/json',
        data: {
            "email": 'eldhose.m@infiny.in',
            "password": 'Infiny123!@#'
        }
    })
        .then((result) => result)
        .catch((error) => error)
}

const shipRocketCreateOrder = (data, shipToken) => {
    console.log('data', data)
    return axios({
        method: 'post',
        url: 'https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',
        data: data,
        form: data,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${shipToken}`
        }
    })
        .then(result => {
            console.log('result=====', result.data)
            return result.data
        })
        .catch((error) => {
            // console.log('error=====', error)
            return error
        })
}

const serviceAvailability = (shipToken, body) => {
    return axios({
        url: `https://apiv2.shiprocket.in/v1/external/courier/serviceability?Content-Type=application/json&pickup_postcode=${body.shipment_id}&order_id=${body.order_id}&cod=${body.type ? 0 : 1}&weight=${body.weight}`,
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${shipToken}`
        }
    })
        .then(result => {
            console.log('Service=====', result.data)
            return result
        })
        .catch((error) => {
            // console.log('error=====', error)
            return error
        })
}

const assignAwb = (shipToken, body) => {
    return axios({
        method: 'post',
        url: `https://apiv2.shiprocket.in/v1/external/courier/assign/awb`,
        data: {
            "shipment_id": body.shipment_id,
            "courier_id": body.company_id
        },
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${shipToken}`
        }
    })
        .then(result => {
            console.log('awb=====', result.data)
            return result.data
        })
        .catch((error) => {
            console.log('error awb=====', error)
            return error
        })
}

const genratePickup = (shipToken, body) => {
    return axios({
        method: 'post',
        url: `https://apiv2.shiprocket.in/v1/external/courier/generate/pickup`,
        data: {
            "shipment_id": body.shipment_id,
            "courier_id": body.company_id
        },
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${shipToken}`
        }
    })
        .then(result => {
            console.log('picku[p]=====', result.data)
            return result.data
        })
        .catch((error) => {
            // console.log('error=====', error)
            return error
        })
}

const generateLabel = (shipToken, body) => {
    return axios({
        method: 'post',
        url: `https://apiv2.shiprocket.in/v1/external/courier/generate/label`,
        data: {
            "shipment_id": [body.shipment_id],
        },
        json: true,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${shipToken}`
        }
    })
        .then(result => {
            console.log('label=====', result.data)
            return result.data
        })
        .catch((error) => {
            // console.log('error=====', error)
            return error
        })
}

const reqgisterToShipRocket = async (data) => {
    let login = await shipRocketLogin()
    if (login.status == 200) {
        let shipToken = login.data.token
        let createOrder = await shipRocketCreateOrder(data, shipToken)
        console.log('\n\ncreteOrder', createOrder)
        if (!createOrder.message) {
            let service = await serviceAvailability(shipToken, { shipment_id: createOrder.shipment_id, order_id: createOrder.order_id, type: data.type, weight: data.weight })
            console.log('\n\nservice.data', service.message)
            if (!service.message) {
                console.log('\n\nservice.data', service.data)
                let company_id = service.data.recommended_courier_company_id
                let awbData = await assignAwb(shipToken, { company_id, shipment_id: createOrder.shipment_id })
                if (!awbData.message) {
                    let pickup = await genratePickup(shipToken, { company_id, shipment_id: createOrder.shipment_id })
                    if (!pickup.message) {
                        let generatedlabel = await generateLabel(shipToken, { shipment_id: createOrder.shipment_id })
                        if (!generatedlabel.message) {
                            return { error: false, docketUrl: generatedlabel.label_url }
                        } else {
                            return { error: true, title: pickup.message }
                        }
                    } else {
                        return { error: true, title: pickup.message }
                    }
                } else {
                    return { error: true, title: awbData.message }
                }
            } else {
                return { error: true, title: service.message }
            }
        } else {
            return { error: true, title: createOrder.message }
        }
    } else {
        return { error: true, title: 'Error while login!. Invalid credentials' }
    }
}

const enableAdminToShipRocket = async (data) => {
    let login = await shipRocketLogin()
    if (login.status == 200) {
        let shipToken = login.data.token
        // var data = JSON.stringify({ "pickup_location": "astroadmin", "name": "Astro", "email": "eldhose.m@infiny.in", "phone": 9421693041, "address": "sector 17, sanpada, navi mumbai", "city": "mumbai", "state": "maharashtra", "country": "India", "pin_code": 400705 });

        var config = {
            method: 'post',
            url: 'https://apiv2.shiprocket.in/v1/external/settings/company/addpickup',
            headers: {
                'token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImVsZGhvc2UubUBpbmZpbnkuaW4iLCJ1c2VyX2lkIjoiNWYyZDUzMzljMjc1ZWUwOWU3MjY5ZWNhIiwidXNlcl90eXBlIjoiYWRtaW4iLCJpc01vYmlsZSI6ZmFsc2UsImV4cCI6MTgxNjI1NTEzNiwiaWF0IjoxNjAwMjU1MTM2fQ.wPB0lZxzW-12uZ5uEB2WsJEfN1dDMigToGj7R2tT0I4',
                'Authorization': `Bearer ${shipToken}`,
                'Content-Type': 'application/json'
            },
            data: data
        };

        let register = await axios(config)
            .then((response) => {
                console.log('response', response)
                return response
            })
        // .catch((error) => error);
        if (!register.message) {
            return { error: false, title: 'Admin registered to shiprocket successfully' }
        } else {
            return { error: true, title: register.message, register, config }
        }
    } else {
        return { error: true, title: 'Error while login!. Invalid credentials' }
    }
}

const shipRocketUpdateStatus = async () => {
    console.log('\n\nshipRocketUpdateStatus :- ');

    let start_date = new Date();
    start_date.setDate(start_date.getDate() - 31);

    let query = {
        is_deleted: false,
        $and: [
            { 'order_status.status': 'Processed' },
            { 'order_status.status': { $ne: 'Draft' } },
            { 'order_status.status': { $ne: 'Cancelled' } },
            { 'order_status.status': { $ne: 'Delivered' } }
        ],
        createdAt: { $gte: start_date }
    }

    let login = await shipRocketLogin()

    if (login.status == 200) {

        console.log('\n\nLOGIN RESULT :- ', login);

        let shipToken = login.data.token

        productOrderModel.aggregate([
            { $match: query },
            {
                $lookup: {
                    localField: 'user_id',
                    foreignField: '_id',
                    from: 'users',
                    as: 'user'
                }
            },
            { $unwind: '$user' }
        ]).then((results) => {

            console.log('\n\n\nRESULTS', results);

            async.eachOfSeries(results, (data, key, cb) => {

                request.get({
                    url: `https://apiv2.shiprocket.in/v1/external/courier/track/shipment/${data.shipment_id}`,
                    json: true,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${shipToken}`
                    }
                }, (error, shipUserResponse, shipUserBody) => {

                    if (shipUserBody != undefined && shipUserBody.tracking_data != undefined && !shipUserBody.tracking_data.error) {
                        
                        if ((data.order_status[data.order_status.length - 1].status != shipUserBody.tracking_data.shipment_track_activities[0].status) && getStatus(data.order_status[data.order_status.length - 1].status) !== 'Delivered') {
                            
                            let orderStatus = {
                                status: getStatus(shipUserBody.tracking_data.shipment_track_activities[0].status),
                                description: shipUserBody.tracking_data.shipment_track_activities[0].activity,
                                date: new Date(shipUserBody.tracking_data.shipment_track_activities[0].date)
                            }
                    
                            let updatedQuery = { $push: { order_status: orderStatus } };
                            updateOrder(data, updatedQuery, orderStatus, cb);

                        }

                        else {

                            if (data.order_status[data.order_status.length - 1].status == 'EOD-38' || data.order_status[data.order_status.length - 1].status == 'EOD-135' || data.order_status[data.order_status.length - 1].status == 'delivered' || data.order_status[data.order_status.length - 1].status == '000') {
                                
                                productOrderModel.findOne({ order_number: data.order_number }).then((findres) => {
                                    if (findres) {

                                        findres.order_status[findres.order_status.length - 1].status = 'Delivered'
                                        findres.save().then((saved) => {
                                            cb()
                                        })

                                    } 
                                    else {
                                        cb()
                                    }
                                })

                            } 
                            else {
                                cb()
                            }
                    
                        }

                    }
                    else {
                        cb()
                    }
                    
                })

            }, () => {
                return true;
            });

        })

    }

}

const getStatus = (data) => {
    switch (data) {
        case "DLVD":
        case "delivered":
        case "EOD-38":
        case "EOD-135":
        case "000":
            return 'Delivered'
        default:
            return data
    }
}

const updateOrder = (data, query, orderStatus, cb) => {
    productOrderModel.findOneAndUpdate({ order_number: data.order_number }, query, { new: true }).exec(async (error, ProcessedOrder) => {
        cb()
    })
}

module.exports = {
    shipRocketLogin,
    reqgisterToShipRocket,
    enableAdminToShipRocket,
    shipRocketUpdateStatus
}
