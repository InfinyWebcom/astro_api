var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
    question: String,
    answer: String,
}, {
    timestamps: true
});

const question = module.exports = mongoose.model('question', schema);

module.exports.addFAQ = (req, cb) => {
    let data = new question({
        question: req.body.question,
        answer: req.body.answer
    });

    data.save((error, response) => {
        if (error) {
            return cb(error);
        }
        else {
            return cb(null, response);
        }
    });
}

module.exports.getQuestions = async(req, cb)=>{

    let data = await question.find({ })
    .then( result=> result)

    return data
}