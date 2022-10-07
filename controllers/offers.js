/* NODE-MODULES */
const helper = require('../lib/helper');

/* Models */
const Offers = require('../models/offer');

const addOffer = async (req, res) => {

    let offerData = new Offers({
        name: req.body.name,
        isActive: req.body.isActive,
        type: req.body.type
    });

    offerData.save((err, offerInfo) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong.',
                error: true
            });
        }
        else {
            return res.status(200).json({
                title: 'Offer Added Successfully',
                error: false,
            })
        }
    })

}


module.exports = {
    addOffer,
}