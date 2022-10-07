/* NODE-MODULES */
var express = require('express');
var app = express();
var http = require('http');
var mongoose = require('mongoose');
var debug = require('debug')('nodeapi:server');
var bodyParser = require('body-parser');
var fs = require('fs')
var path = require('path');
var cronJob = require('cron').CronJob;
require('dotenv').config();

/* helper */
const helper = require('./lib/helper');
const courierService = require('./lib/courierService');

/* Controllers */
var userController = require('./controllers/user');
var serviceRequestController = require('./controllers/serviceRequest');
var referralController = require('./controllers/referral');
var chatController = require('./controllers/chat');
var settlementController = require('./controllers/settlement');

/* ROUTES */
var admin = require('./routes/admin');
var users = require('./routes/users');
var services = require('./routes/services');
var products = require('./routes/products');
var cart = require('./routes/cart');
var productOrders = require('./routes/productOrders');
var serviceRequest = require('./routes/serviceRequests');
var call = require('./routes/calldetails');
var chat = require('./routes/chat');
var transaction = require('./routes/transactions');
var settlement = require('./routes/settlements');
var notification = require('./routes/notifications');
var question = require('./routes/questions');
var report = require('./routes/reports');
var referral = require('./routes/referrals');
var callRequest = require('./routes/callRequests');
var rating = require('./routes/ratings');
var blog = require('./routes/blog')
var banner = require('./routes/banner')
var offers = require('./routes/offers')
var knowlarity_feeds = require('./routes/knowlarity_feeds')

/* connect mongodb */
//mongoose.connect('mongodb://localhost/astroapi', { useNewUrlParser: true });
console.log('Database :', process.env.db);

mongoose.connect(process.env.db, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, useFindAndModify: false });
//mongoose.set('debug', true);
app.use(bodyParser.json({ limit: "500mb" }));
app.use(bodyParser.urlencoded({ limit: "500mb", extended: true, parameterLimit: 50000 }))
app.use(express.json());


/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '5256');
app.set('port', port);

/**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

/* test */
app.get('/', function (req, res) {
  res.send('Hello World!');
});

app.use(function (req, res, next) {
  const allowedOrigins = ['http://localhost:3000', 'https://astrowize-web.infiny.dev', "https://astrowize-home.infiny.dev", "https://admin.astrowize.com", "https://astrowize.com"];
  const origin = req.headers.origin;
  if (allowedOrigins.indexOf(origin) > -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', "https://astrowize-web.infiny.dev");
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin,Content-Type, token, x-id, Content-Length, X-Requested-With, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

app.use('/user', users);
app.use('/admin', admin)
app.use('/service', services);
app.use('/product', products);
app.use('/cart', cart);
app.use('/productOrder', productOrders);
app.use('/serviceRequest', serviceRequest);
app.use('/call', call);
app.use('/chat', chat);
app.use('/transaction', transaction);
app.use('/settlement', settlement);
app.use('/notification', notification);
app.use('/question', question);
app.use('/report', report);
app.use('/referral', referral);
app.use('/callRequest', callRequest);
app.use('/rating', rating);
app.use('/blog', blog);
app.use('/banner', banner);
app.use('/offers', offers);
app.use('/knowlarity_feeds', knowlarity_feeds);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);

  console.log("----- onListening", bind);

  chatController.endChatOnRestart();
  chatController.notifyServicePaymentRestart();

}

//cron job to send tip of the day to consumers at 7 am for all day
var job = new cronJob({
  cronTime: '00 00 07 * * *',
  onTick: function () {
    console.log('hi in cron job')
    let mailData = {
      email: process.env.mail_username,
      subject: 'Welcome To AstroWize',
      body:
        '<p>' +
        'Cron check'
    };
    helper.sendEmail(mailData);

    userController.sendTipOfTheDay()
    serviceRequestController.serviceReminder()

  },
  start: true,
  timeZone: helper.getTimezone()
});
job.start();

//to send transaction details to referror at 12 am on every month date 1.
var referrorJob = new cronJob({
  cronTime: '0 0 1 * *',
  onTick: function () {
    console.log('hi in cron job')
    let mailData = {
      email: process.env.mail_username,
      subject: 'Welcome To AstroWize',
      body:
        '<p>' +
        'Referror cron check'
    };
    helper.sendEmail(mailData);

    referralController.referralTransactions()
  },
  start: true,
  timeZone: helper.getTimezone()
});
referrorJob.start();

/*
To settle payments with astrologers each week
*/
// var settlementJob = new cronJob({
//   cronTime: '*/30 *	* * * * ',
//   onTick: function () {
//     console.log('\nSettlement CRON is running.\n')
//     settlementController.settlementsCron()
//   },
//   start: true,
//   timeZone: helper.getTimezone()
// });
// settlementJob.start();

/*
To check status of shipments everyday
*/
var shipRocketUpdateJob = new cronJob({
  cronTime: '*/10	* * * *	',
  onTick: function () {
    console.log('\nShipRocketUpdateStatus CRON is running.\n')
    courierService.shipRocketUpdateStatus()
  },
  start: true,
  timeZone: helper.getTimezone()
});
shipRocketUpdateJob.start();

/*
To check status of shipments everyday
*/
var markServiceCompleted = new cronJob({
  // cronTime: '*/10 *	* * * *	',
  cronTime: '0 0 * * *',
  onTick: () => {
    serviceRequestController.markServiceCompleted()
  },
  start: true,
  timeZone: helper.getTimezone()
});
markServiceCompleted.start();

module.exports = app;