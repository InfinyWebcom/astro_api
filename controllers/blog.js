const Blog = require('../models/blog');
const helper = require('../lib/helper');
const { check, validationResult, body } = require('express-validator');


const add = async (req, res) => {
    const result = validationResult(req);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    let dir = './assets/blogs/';
    let image = await helper.base64Upload(dir, req.body.blog_image)
    let body = { ...req.body }
    body.image = '/blogs/' + image
    setTimeout(function () {
        helper.getThumbnail(dir, image + '.jpg', image, function (status) {
            console.log('signup getThumbnail -- ', status);
        });
    }, 2000);
    // Object.assign(body, image);
    console.log('body', body)
    let data = await Blog.add(body);
    res.status(200).json({
        error: false,
        title: 'Blog added successfully',
        data
    })
}
const find_by_id = async (req, res) => {
    let query = { _id: req.body.Id }
    let data = await Blog.findOneData(query)
    res.status(200).json({
        error: false,
        data: data
    })
}
const list = async (req, res) => {
    let data = await Blog.list(req);
    if (!data) {
        res.status(200).json({
            error: false,
            data: [],
            total_count: 0,
        })
    }
    res.status(200).json({
        error: false,
        data: data.length > 0 ? data[0].data : [],
        total_count: data.length > 0 ? data[0].totalCount: 0,
    })
}
const deleteById = async (req, res) => {
    let data = await Blog.updateData({ _id: req.body.Id }, { is_deleted: true })
    if (data) {
        res.status(200).json({
            error: false,
            title: 'Blog deleted successfully'
        })
    } else {
        res.status(200).json({
            error: true,
            title: 'This blog not found'
        })
    }
}
const updateById = async (req, res) => {
    const result = validationResult(req);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }
    let newBase64Str = req.body.blog_image.replace(/(\r\n|\n|\r)/gm, "")
    var matches = newBase64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let body = { ...req.body }
    if (!matches || matches.length !== 3) {
    }
    else if (req.body.blog_image && req.body.blog_image != "") {
        let dir = './assets/blogs/';
        let image = await helper.base64Upload(dir, req.body.blog_image)
        body.image = '/blogs/' + image
        setTimeout(function () {
            helper.getThumbnail(dir, image + '.jpg', image, function (status) {
                console.log('signup getThumbnail -- ', status);
            });
        }, 2000);
    }
    let data = await Blog.updateData({ _id: req.body.Id }, body)
    if (data) {
        res.status(200).json({
            error: false,
            title: 'Blog updated successfully'
        })
    } else {
        res.status(200).json({
            error: true,
            title: 'This blog not found'
        })
    }
}
module.exports = {
    add,
    find_by_id,
    list,
    deleteById,
    updateById
}