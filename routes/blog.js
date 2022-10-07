const express = require('express');
const router = express.Router()
const blogController = require('../controllers/blog')
const { check, validationResult, body } = require('express-validator');
var auth = require("../lib/auth");
router.post('/add', [
    check('name', 'Name is required').notEmpty(),
    check('blog_image', 'Blog image is required').notEmpty(),
    check('content', 'Content is required').notEmpty(),
], [auth.authenticateUser], (req, res) => {
    blogController.add(req, res)
})
router.post('/update', [
    check('name', 'Name is required').notEmpty(),
    check('blog_image', 'Blog image is required').notEmpty(),
    check('content', 'Content is required').notEmpty(),
], [auth.authenticateUser], (req, res) => {
    blogController.updateById(req, res)
})
router.post('/delete', [auth.authenticateUser], (req, res) => {
    blogController.deleteById(req, res)
})
router.post('/find_by_id', (req, res) => {
    blogController.find_by_id(req, res)
})
router.post('/list', (req, res) => {
    blogController.list(req, res)
})
module.exports = router;