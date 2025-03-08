const ProductReview = require('../models/ProductReview');
const Products = require('../models/Product');
const Users = require('../models/User');
const { getUser } = require('../config/getUser');
const Orders = require('../models/Order');
const blurDataUrl = require('../config/getBlurDataURL');
const getProductReviewsbyPid = async (req, res) => {
  try {
    // Populate the product
    const pid = req.params.pid;
    // Get reviews for the populated product
    const reviews = await ProductReview.find({
      product: pid,
    })
      .sort({
        createdAt: -1,
      })
      .populate({
        path: 'user',
        select: ['firstName', 'lastName', 'cover', 'orders'],
      });
    const product = await Products.findById(pid).select(['slug']);

    const reviewsSummery = await Products.aggregate([
      {
        $match: { slug: product.slug },
      },

      {
        $lookup: {
          from: 'productreviews',
          localField: '_id',
          foreignField: 'product',
          as: 'productreviews',
        },
      },
      {
        $unwind: '$productreviews',
      },

      {
        $group: {
          _id: '$productreviews.rating',
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(201).json({ success: true, reviewsSummery, reviews });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const createProductReview = async (req, res) => {
  try {
    const user = await getUser(req, res);
    const uid = user._id.toString();
    const { pid, rating, review: reviewText, images } = req.body;

    const orders = await Orders.find({
      'user.email': user.email,
      'items.pid': pid,
    });

    const updatedImages = await Promise.all(
      images.map(async (image) => {
        const blurDataURL = await blurDataUrl(image);
        return { url: image, blurDataURL };
      })
    );
    const review = await ProductReview.create({
      product: pid,
      review: reviewText,
      rating,
      images: updatedImages,
      user: uid,
      isPurchased: Boolean(orders.length),
    });

    await Products.findByIdAndUpdate(pid, {
      $addToSet: {
        reviews: review._id,
      },
    });

    return res.status(201).json({ success: true, data: review, user });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getProductReviewsByAdmin = async (req, res) => {
  try {
    const reviews = await ProductReview.find(
      {}
    ); /* find all the data in our database */
    return res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const createProductReviewByAdmin = async (req, res) => {
  try {
    const { _id, review } = await req.body;
    const isProductReview = await ProductReview.findOne({ _id: _id });
    const product = await Products.findOne({ _id: _id });

    await Products.findByIdAndUpdate(
      _id,
      {
        totalProductReview: product.totalProductReview + 1,
        totalRating: product.totalRating + review.rating,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (isProductReview) {
      const filtered = isProductReview.ratings.filter(
        (v) => v.name === `${review.rating} Star`
      )[0];
      const notFiltered = isProductReview.ratings.filter(
        (v) => v.name !== `${review.rating} Star`
      );

      const alreadyProductReview = await ProductReview.findByIdAndUpdate(
        _id,
        {
          ratings: [
            ...notFiltered,
            {
              name: `${review.rating} Star`,
              reviewCount: filtered.reviewCount + 1,
              starCount: filtered.starCount + 1,
            },
          ],
          reviews: [...isProductReview.reviews, { ...review }],
        },
        {
          new: true,
          runValidators: true,
        }
      );

      return res
        .status(400)
        .json({ success: true, data: alreadyProductReview });
    } else {
      const ratingData = [
        {
          name: '1 Star',
          starCount: 0,
          reviewCount: 0,
        },
        {
          name: '2 Star',
          starCount: 0,
          reviewCount: 0,
        },
        {
          name: '3 Star',
          starCount: 0,
          reviewCount: 0,
        },
        {
          name: '4 Star',
          starCount: 0,
          reviewCount: 0,
        },
        {
          name: '5 Star',
          starCount: 0,
          reviewCount: 0,
        },
      ];

      const filtered = ratingData.filter(
        (v) => v.name === `${review.rating} Star`
      )[0];
      const notFiltered = ratingData.filter(
        (v) => v.name !== `${review.rating} Star`
      );

      const newProductReview = await ProductReview.create([
        {
          _id: _id,
          ratings: [
            ...notFiltered,
            {
              name: `${review.rating} Star`,
              reviewCount: filtered.reviewCount + 1,
              starCount: filtered.starCount + 1,
            },
          ],
          reviews: [{ ...review }],
        },
      ]);

      return res.status(201).json({ success: true, data: newProductReview });
    }
  } catch (error) {
    return res.status(400).json({ success: false, error: message.error });
  }
};

module.exports = {
  getProductReviewsbyPid,
  createProductReview,
  getProductReviewsByAdmin,
  createProductReviewByAdmin,
};
