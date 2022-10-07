/* NODE-MODULES */
const express = require('express');
const router = express.Router();

/* CONTROLLER MODULES */
const banner = require('../controllers/banner');


router.post('/list', (req, res, next) => {
    banner.listBanners(req, res); 
});

router.post('/add', (req, res, next) => {
    banner.addBanner(req, res); 
});

router.post('/delete', (req, res, next) => {
    banner.deleteBanner(req, res); 
});


module.exports = router;