/* NODE-MODULES */
const jwt = require('jsonwebtoken');
const fs = require('fs');
var moment = require('moment-timezone');
const nodemailer = require('nodemailer');
var base64ToImage = require('base64-to-image');
const randomstring = require("randomstring");
const fetch = require('node-fetch');
const pdf = require("html-pdf");
const ejs = require("ejs");

/* Models */
let groupModule = require('../models/permissionGroup');
const signModel = require('../models/astrosign');
const systemConfig = require('../models/systemConfig');
const Knowlarity = require('../models/knowlarity');

const generateToken = (userData, cb) => {
    console.log('userData', userData)
    var token = jwt.sign({
        email: userData.userData ? userData.userData.email : userData.email,
        user_id: userData.userData ? userData.userData._id : userData._id,
        user_type: userData.userData ? userData.userData.user_type : userData.user_type,
        isMobile: userData.isMobile ? userData.isMobile : false,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 60 * 1000),

    }, "astroapi");
    cb(token)
}

const decodeToken = (token) => {
    var decoded = jwt.decode(token, "astroapi");
    return decoded;
}

const getTimezone = (token) => {
    return 'Asia/Kolkata';
}

const sendEmail = (data) => {
    let smtpTransport = nodemailer.createTransport({
        tls: { rejectUnauthorized: false },
        secureConnection: false,
        host: "smtp.gmail.com",
        port: 587,
        requiresAuth: true,
        auth: {
            user: process.env.mail_username,
            pass: process.env.mail_password
        }
    });

    let mailOptions = {
        to: data.email,
        from: process.env.mail_username,
        subject: data.subject,
        html: data.body
    };

    if (data.attachments) {
        mailOptions.attachments = data.attachments
    }

    if (data.cc && data.cc.length > 0) {
        mailOptions.cc = data.cc;
    }

    smtpTransport.sendMail(mailOptions, function (err) {
        console.log('mail err', err);
        return true;
    });
}

const createDir = (targetDir) => {
    const path = require('path');
    const sep = path.sep;
    const initDir = path.isAbsolute(targetDir) ? sep : '';
    targetDir.split(sep).reduce((parentDir, childDir) => {
        const curDir = path.resolve(parentDir, childDir);
        if (!fs.existsSync(curDir)) {
            fs.mkdirSync(curDir);
        }
        return curDir;
    }, initDir);
}

/* To unlink files */
const unlinkFile = (oldImage) => {
    console.log('unlinkFile oldImage err --', oldImage);
    fs.stat(oldImage, function (err, stat) {
        console.log('user oldImage err --', err, stat);
        if (err == null) {
            fs.unlinkSync(oldImage, function (err, succ) {
                if (err) {
                    console.log('user.profileImage err --', err);
                } else {
                    console.log('user.profileImage suc --');
                }
            });
        } else if (err.code == 'ENOENT') {
            console.log('user.profileImage ENOENT --');
        } else {
            console.log('user.profileImage ENOENT else--');
        }
    });
}

const writeFile = (errLog, folder) => {
    var updatedAt = new Date();
    var date = new Date(updatedAt.getTime() + moment.tz(getTimezone()).utcOffset() * 60000);
    errLog += "########## \r\n";
    createDir(`./${folder}`);
    fs.appendFileSync(`./${folder}/${date.toISOString().slice(0, 10)}.txt`, errLog + "\r\n", function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}

const getPermissionGroupId = (groupName, cb) => {
    groupModule.findOne({ name: groupName })
        .exec((error, groupData) => {
            cb(error, groupData)
        })
}

const base64Upload = (path, base64Str) => {
    createDir(path);
    var ext = base64Str.substring(base64Str.indexOf('/') + 1, base64Str.indexOf(';base64'));
    console.log('base64Upload ext - ', ext);
    picName = randomstring.generate({
        length: 8,
        charset: 'alphanumeric'
    });

    if (ext == 'png') {
        console.log('base64Upload png - ', ext);
    }
    if (ext != 'pdf') {
        console.log('base64Upload pdf - ', ext);
        ext = 'jpg'
    }
    var optionalObj = { 'fileName': picName, 'type': ext };
    console.log('extension ----- ', picName)

    let newBase64Str = base64Str.replace(/(\r\n|\n|\r)/gm, "")
    var Image = base64ToImage(newBase64Str, path, optionalObj);
    console.log('Image fileName----- ', Image.fileName)

    if (ext != 'pdf') {
        return picName
    }
    return Image.fileName;
}

const getThumbnail = (dir, fileName, tempfileName, cb) => {
    console.log("getThumbnail-", dir, 'fileName-', fileName, 'tempfileName-', tempfileName);

    // generate thumbnail
    var thumb = require('node-thumbnail').thumb;
    thumb({
        prefix: '',
        suffix: '_small',
        source: dir + fileName,
        destination: dir,
        width: 100,
        overwrite: true,
        concurrency: 4,
        basename: tempfileName

    }).then(function () {
        console.log("getThumbnail function")
    }).catch(function (e) {
        console.log("getThumbnail e-", e)
    });

    thumb({
        prefix: '',
        suffix: '_medium',
        source: dir + fileName,
        destination: dir,
        width: 300,
        overwrite: true,
        concurrency: 4,
        basename: tempfileName
    }).then(function () {
        console.log("getThumbnail function")
    }).catch(function (e) {
        console.log("getThumbnail e-", e)
    });
    cb(true)
}

/*
# parameters: userToken
# purpose: to get zodiac sign according to birth date
*/
const getZodiacSign = async (month, day) => {
    console.log('getZodiacSign month', month);
    console.log('getZodiacSign day ', day);

    var bound = [19, 18, 20, 19, 20, 20, 22, 22, 22, 22, 21, 21];
    //startMonth is zero indexed and returns the zodiac sign of the start of that month
    //ie. startMonth[0] = "Capricorn"; means start of January is Zodiac Sign "Capricorn"
    var startMonth = ["Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini",
        "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"];
    monthIndex = month; //so we can use zero indexed arrays
    if (day <= bound[monthIndex]) { //it's start of month -- before or equal to bound date
        signMonthIndex = monthIndex;
    } else { //it must be later than bound, we use the next month's startMonth
        signMonthIndex = (monthIndex + 1) % 12; //mod 12 to loop around to January index.
    }

    console.log('getZodiacSign signMonthIndex ', signMonthIndex);
    let data = await signModel.getAstroSignByQuery({ name: startMonth[signMonthIndex] });

    console.log('getZodiacSign data ', data);

    return data;
}

const randomDarkColor = () => {
    var lum = -0.25;
    var hex = String('#' + Math.random().toString(16).slice(2, 8).toUpperCase()).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var rgb = "",
        c, i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ("00" + c).substr(c.length);
    }
    console.log('rgb -- ', rgb);

    return hexToRGB(rgb)
}

const hexToRGB = (hex) => {
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;
    console.log('hexToRGB  -- ', [r, g, b]);

    return { red: r, green: g, blue: b }
}

/*
# parameters: to, message
# purpose: To send SMS
*/
const sendSMS = (smsData) => {
    console.log('sendSMS data', smsData)

    let url = "http://sms.bkarma.in/api/v2/sms/send/json"
    var data = {}
    data.root = {
        "service": "T",
        "sender": process.env.smsSenderId,
        "message": "global message",
        "template_id": smsData.template_id
    }

    data.nodes = []
    smsData.to.forEach(to_number => {
        data.nodes.push({
            "to": to_number,
            "sender": process.env.smsSenderId,
            "message": smsData.message
        })
    })

    const headers = {
        "Authorization": `Bearer ${process.env.smsToken}`,
        "Content-Type": 'application/json'
    }

    fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(data) })
        .then((response) => {
            return response.json()
        })
        .then((result) => {
            console.log('sendSMS result', result);

            return result
        })
}

const renderMessageFromTemplateAndVariables = (templateData, variablesData) => {
    var Handlebars = require('handlebars');
    return Handlebars.compile(templateData)(variablesData);
}

const generateLabel = async (orderObj, req) => {

    let dir = './assets/invoices/';
    createDir(dir);

    let pdfName = randomstring.generate({
        length: 8,
        charset: 'alphanumeric'
    });

    let contents = fs.readFileSync('./views/shipping_label.ejs', 'utf8');

    let order_items_arr = [];

    orderObj.products.forEach((product, i) => {
        let temp = {
            name: product.product_id.name,
            sku: 'gems',
            units: product.quantity,
            selling_price: product.rate,
            discount: 0
        }
        order_items_arr.push(temp);
    });

    // let systemConfigData = await systemConfig.getAllSystemConfig();
    // console.log('\n\nCreate Invoice - systemConfigData', systemConfigData);

    let OrderDetails = {};
    // OrderDetails.sgst = systemConfigData[0].sgst
    // OrderDetails.cgst = systemConfigData[0].cgst
    // OrderDetails.other_charges = systemConfigData[0].other_charges
    OrderDetails.sgst = 0
    OrderDetails.cgst = 0
    OrderDetails.other_charges = 0
    OrderDetails.title = 'Testing Invoice'
    OrderDetails.order_id = orderObj.order_number
    OrderDetails.order_date = moment(orderObj.createdAt).format('DD-MM-YYYY')
    OrderDetails.billing_customer_name = orderObj.user_id.first_name
    OrderDetails.billing_address = `${orderObj.user_id.user_address.block_number}, ${orderObj.user_id.user_address.building_name}, ${orderObj.user_id.user_address.street_address}`
    OrderDetails.billing_city = orderObj.user_id.user_address.user_city
    OrderDetails.billing_pincode = orderObj.user_id.user_address.pincode
    OrderDetails.billing_state = orderObj.user_id.user_address.user_state
    OrderDetails.billing_country = 'India'
    OrderDetails.order_items = order_items_arr
    OrderDetails.sub_total = req.body.total_amount
    // OrderDetails.base_url = 'http://localhost:5256/'
    OrderDetails.base_url = 'https://api.astrowize.com/'

    let html = ejs.render(contents, OrderDetails);
    let path = dir + pdfName + '.pdf';
    let fileName = '/invoices/' + pdfName + '.pdf';

    pdf.create(html).toBuffer(async (err, buffer) => {

        fs.writeFile(path, buffer, function (err) {
            if (err) {
                console.log('Create Invoice write error', err);
            }
            console.log('Create Invoice write success', err);
        });

    });

    return fileName;

}

const getTransactionId = (cb) => {
    Number.prototype.pad = function (size) {
        var s = String(this);
        while (s.length < (size || 2)) { s = "0" + s; }
        return s;
    }
    let transId = ''
    let twoDigitsCurrentYear = parseInt(new Date().getFullYear().toString().substr(2, 2));

    transId = 'AST'.concat(twoDigitsCurrentYear);
    Knowlarity.findOne()
        .sort({ createdAt: -1 })
        .exec((err, transData) => {
            if (err) {
                return cb(err)
            } else if (!transData) {
                transId = transId.concat("0000001");
                return cb(null, transId)
            }
            else {
                if (transData.transaction_id !== undefined) {
                    if (parseInt(new Date(transData.createdAt).getFullYear().toString().substr(2, 2) > twoDigitsCurrentYear)) {
                        let transId = ''
                        let twoDigitsCurrentYear = parseInt(new Date().getFullYear().toString().substr(2, 2));
                        transId = 'AST'.concat(twoDigitsCurrentYear);
                        transId = transId.concat((1).pad(7));
                        return cb(null, transId);
                    } else {
                        let tempNumString = parseInt(transData.transaction_id.replace(/^\D+/g, ''));
                        let incrementedId = parseInt(tempNumString) + 1;
                        transId = "AST".concat((incrementedId).pad(7));
                        return cb(null, transId);
                    }
                } else {
                    transId = transId.concat("0000001");
                    return cb(null, transId);
                }
            }
        });
}

module.exports = {
    generateToken,
    decodeToken,
    sendEmail,
    createDir,
    unlinkFile,
    writeFile,
    getPermissionGroupId,
    base64Upload,
    getThumbnail,
    getZodiacSign,
    randomDarkColor,
    getTimezone,
    sendSMS,
    renderMessageFromTemplateAndVariables,
    generateLabel,
    getTransactionId
}