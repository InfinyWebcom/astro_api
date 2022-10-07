/* NODE-MODULES */
const helper = require('../lib/helper');

/* Models */
const banners = require('../models/banner');

/*
# parameters: none
# purpose: Listing of all banners
*/
const listBanners = (req, res) => {
    banners.find({})
        .exec((error, bannerList) => {
            if (error) {
                return res.status(200).json({
                    title: 'Something went wrong.',
                    error: true
                })
            } else {
                return res.status(200).json({
                    title: 'Banners Fetched Successfully',
                    error: false,
                    detail: bannerList
                })
            }
        })
}

/*
# parameters: banner_image
# purpose: Add a banner
*/
const addBanner = async (req, res) => {

    let dir = './assets/banners/';
    let image = await helper.base64Upload(dir, req.body.banner_image)

    let bannerData = new banners({
        banner_image: '/banners/' + image,
    });

    bannerData.save((err, bannerInfo) => {
        if (err) {
            return res.status(200).json({
                title: 'Something went wrong while uploading the banner image.',
                error: true
            });
        }
        else {
            return res.status(200).json({
                title: 'Banner Image Uploaded Successfully',
                error: false,
            })
        }
    })

}

/*
# parameters: banner_id
# purpose: Delete a banner
*/
const deleteBanner = (req, res) => {

    let bannerId = req.body.banner_id;

    banners.findById(bannerId)
        .then((banner, error) => {
            if (banner) {
                banner.remove();
                return res.status(200).json({
                    title: 'Banner Image Deleted Successfully',
                    error: false,
                    detail: banner
                });
            }
            else {
                return res.status(200).json({
                    error: false,
                    detail: 'Banner Image Not Found'
                });
            }

        })
}

module.exports = {
    listBanners,
    addBanner,
    deleteBanner
}