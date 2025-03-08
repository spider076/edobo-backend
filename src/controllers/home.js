// controllers/newsController.js
const BrandModel = require('../models/Brand');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Shop = require('../models/Shop'); // Added Shop model

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .select(['name', 'cover', 'slug', 'status'])
      .limit(6).sort({
        createdAt: -1
      });
    res.status(201).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getTopRatedProducts = async (req, res) => {
  try {
    const { city } = req.query;
    const shopsInCity = city ? await Shop.find({
      'address.city': { $regex: new RegExp(city, 'i') }
    }).select('_id') : null;

    if (city && (!shopsInCity || shopsInCity.length === 0)) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const matchStage = city ? {
      $match: {
        shop: { $in: shopsInCity.map(shop => shop._id) }
      }
    } : null;

    const pipeline = [
      matchStage,
      {
        $lookup: {
          from: 'productreviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $sort: {
          averageRating: -1,
        },
      },
      {
        $limit: 8,
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          vendor: 1,
          shop: 1,
          createdAt: 1,
        },
      },
    ].filter(Boolean); // Remove null stages

    const bestSellingProduct = await Product.aggregate(pipeline);

    res.status(200).json({ success: true, data: bestSellingProduct });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getBrands = async (req, res) => {
  try {
    const brandsWithProductCount = await BrandModel.aggregate([
      {
        $lookup: {
          from: 'products', // The collection name of the ProductModel
          localField: '_id',
          foreignField: 'brand',
          as: 'products',
        },
      },
      {
        $addFields: {
          totalProducts: { $size: '$products' },
        },
      },
      {
        $project: {
          name: 1,
          logo: 1,
          slug: 1,
          status: 1,
          totalProducts: 1,
        },
      },
    ]);

    res.status(201).json({ success: true, data: brandsWithProductCount });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getBestSellerProducts = async (req, res) => {
  try {
    const bestSellingProduct = await Product.aggregate([
      {
        $lookup: {
          from: 'productreviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $sort: {
          sold: -1,
        },
      },
      {
        $limit: 8,
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          vendor: 1,
          shop: 1,
          createdAt: 1,
        },
      },
    ]);
    return res.status(200).json({ success: true, data: bestSellingProduct });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getFeaturedProducts = async (req, res) => {
  try {
    const featured = await Product.aggregate([
      {
        $lookup: {
          from: 'productreviews',
          localField: 'reviews',
          foreignField: '_id',
          as: 'reviews',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $match: {
          isFeatured: true,
        },
      },
      {
        $limit: 8,
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          vendor: 1,
          shop: 1,
          createdAt: 1,
        },
      },
    ]);
    return res.status(200).json({ success: true, data: featured });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategories,
  getTopRatedProducts,
  getBrands,
  getBestSellerProducts,
  getFeaturedProducts,
};
