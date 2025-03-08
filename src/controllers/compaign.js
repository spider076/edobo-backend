const Compaign = require('../models/Compaign');
const Product = require('../models/Product');
const _ = require('lodash');
const getBlurDataURL = require('../config/getBlurDataURL');
const { getVendor, getAdmin, getUser } = require('../config/getUser');
const { singleFileDelete } = require('../config/uploader');
// Admin apis
const getAdminCompaigns = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalCompaigns = await Compaign.countDocuments();

    const compaigns = await Compaign.find({}, null, {
      skip: skip,
      limit: parseInt(limit),
    })
      .select([
        'slug',
        'status',
        'products',
        'name',
        'startDate',
        'endDate',
        'discount',
        'discountType',
      ])
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      data: compaigns,
      count: Math.ceil(totalCompaigns / limit),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const createCompaign = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);
    const { cover, products, discountType, discount, ...others } = req.body;
    const productsWithPrice = await Product.find({
      _id: { $in: products },
    }).select(['price', 'priceSale']);
    for (const product of productsWithPrice) {
      const newPriceSale =
        discountType === 'percent'
          ? product.price * (1 - discount / 100)
          : product.price - discount;
      await Product.updateOne(
        { _id: product._id },
        { $set: { priceSale: newPriceSale, oldPriceSale: product.priceSale } }
      );
    }
    const coverBlurDataURL = await getBlurDataURL(cover.url);

    await Compaign.create({
      ...others,
      products,
      discountType,
      discount,
      cover: {
        ...cover,
        blurDataURL: coverBlurDataURL,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Compaign created',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getOneCompaignByAdmin = async (req, res) => {
  try {
    // const admin = await getAdmin(req, res);
    const { slug } = req.params;

    const compaign = await Compaign.aggregate([
      { $match: { slug: slug } },
      {
        $lookup: {
          from: 'products', // Assuming 'products' is the name of your Product model collection
          localField: 'products', // Field in the Compaign model
          foreignField: '_id', // Field in the Product model
          as: 'productData',
        },
      },
      { $unwind: '$productData' },
      {
        $addFields: {
          'productData.image': { $arrayElemAt: ['$productData.images', 0] },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          cover: 1,
          metaTitle: 1,
          description: 1,
          metaDescription: 1,
          slug: 1,
          discountType: 1,
          discount: 1,
          startDate: 1,
          endDate: 1,
          status: 1,
          // include other fields you need from the Compaign model
          'productData.name': 1,
          'productData._id': 1,
          'productData.priceSale': 1,
          'productData.image.url': 1,
          'productData.image.blurDataURL': 1,
        },
      },
      {
        $group: {
          _id: '$_id',
          name: { $first: '$name' },
          description: { $first: '$description' },
          cover: { $first: '$cover' },
          metaTitle: { $first: '$metaTitle' },
          metaDescription: { $first: '$metaDescription' },
          slug: { $first: '$slug' },
          discountType: { $first: '$discountType' },
          discount: { $first: '$discount' },
          startDate: { $first: '$startDate' },
          endDate: { $first: '$endDate' },
          status: { $first: '$status' },
          // include other fields you need from the Compaign model
          products: { $push: '$productData' },
        },
      },
    ]);

    // Transform the result to match the exact output structure if necessary
    const transformedCompaign = compaign.length > 0 ? compaign[0] : null;

    if (!transformedCompaign) {
      return res.status(404).json({ message: 'Compaign Not Found' });
    }

    return res.status(200).json({
      success: true,
      data: transformedCompaign,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const updateOneCompaignByAdmin = async (req, res) => {
  try {
    const { slug } = req.params;
    const admin = await getAdmin(req, res);
    const { cover, ...others } = req.body;
    const compaign = await Compaign.findOne({ slug });
    if (!compaign) {
      return res.status(404).json({ message: 'Compaign Not Found' });
    }
    const missingProducts = compaign.products.filter(
      (product) => !req.body.products.includes(product)
    );

    const productsWithPrice = await Product.find({
      _id: { $in: missingProducts },
    }).select(['price', 'priceSale']);
    for (const product of productsWithPrice) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { priceSale: product.oldPriceSale, oldPriceSale: null } }
      );
    }

    const coverBlurDataURL = await getBlurDataURL(cover.url);

    await Compaign.findOneAndUpdate(
      { slug: slug },
      {
        ...others,

        cover: { ...cover, blurDataURL: coverBlurDataURL },
      },
      { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, message: 'Updated Compaign' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const deleteOneCompaignByAdmin = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);
    const { cid } = req.params;
    const compaign = await Compaign.findOne({ _id: cid });
    if (!compaign) {
      return res.status(404).json({ message: 'Compaign Not Found' });
    }
    await singleFileDelete(compaign.cover._id);

    await Compaign.deleteOne({ _id: cid }); // Corrected to pass an object to deleteOne method
    return res.status(200).json({
      success: true,
      message: 'Compaign Deleted Successfully', // Corrected message typo
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getCompaignsByUser = async (req, res) => {
  try {
    const { limit } = req.query; // Destructure limit from query parameters

    let query = {}; // Initialize an empty query object
    const currentDate = new Date();

    if (limit) {
      // If limit is provided, convert it to a number and add to query
      const limitNumber = parseInt(limit);
      if (isNaN(limitNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid limit parameter (must be a number).',
        });
      }
      query = { endDate: { $gt: currentDate }, limit: limitNumber };
    } else {
      query = { endDate: { $gt: currentDate } };
    }

    const campaigns = await Compaign.find(query); // Find campaigns with optional limit

    return res.status(200).json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getCompaignBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const compaign = await Compaign.findOne({ slug: slug });
    if (!compaign) {
      return res.status(404).json({ message: 'Compaign Not Found' });
    }
    return res.status(200).json({
      success: true,
      data: compaign,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getCompaignsSlugs = async (req, res) => {
  try {
    const compaigns = await Compaign.find().select(['slug']);

    res.status(201).json({
      success: true,
      data: compaigns,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getCompaignNameBySlug = async (req, res) => {
  try {
    const compaign = await Compaign.findOne({
      slug: req.params.slug,
    }).select([
      'cover',
      'description',
      'name',
      'slug',
      'address',
      'phone',
      'createdAt',
    ]);

    res.status(201).json({
      success: true,
      data: compaign,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
module.exports = {
  getAdminCompaigns,
  createCompaign,
  getOneCompaignByAdmin,
  updateOneCompaignByAdmin,
  deleteOneCompaignByAdmin,
  getCompaignsByUser,
  getCompaignBySlug,
  getCompaignsSlugs,
  getCompaignNameBySlug,
};
