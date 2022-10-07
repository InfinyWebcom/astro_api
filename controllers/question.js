/* NODE-MODULES */
const express = require('express');
const { check, validationResult, body } = require('express-validator');

/* MODELS */
const questionnModel = require('../models/question');
const helper = require('../lib/helper');

/* 
# parameters: token
# purpose: List notifications
*/
const addQuestion = async(req, res) => {
    console.log('addQuestion req.body ', req.body);

    const result = validationResult(req);

    console.log('addQuestion errors ', result);
    if (result.errors.length > 0) {
        return res.status(200).json({
            error: true,
            title: result.errors[0].msg,
            errors: result
        });
    }

    questionnModel.addFAQ(req, (err, data) => {
        console.log('addQuestion data ', err, data);
    
        return res.status(200).json({
            title: 'FAQ added successfully',
            error: false,
            data: data
        });
    });    
}

/* 
# parameters: token
# purpose: List FAQ
*/
const questionListing = async(req, res) => {
    console.log('questionListing req.body ', req.body);

    let data = await questionnModel.getQuestions(req);
    console.log('questionListing data ', data);
    
    return res.status(200).json({
        title: 'FAQ listing',
        error: false,
        data: data
    });
}

module.exports = {
    addQuestion,
    questionListing
}