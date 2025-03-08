const Product = require('../models/Product');
const Shop = require('../models/Shop');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const _ = require('lodash');
const { multiFilesDelete } = require('../config/uploader');
const blurDataUrl = require('../config/getBlurDataURL');
const { getVendor } = require('../config/getUser');

const getProductsByVendor = async (req, res) => {
  try {
    const vendor = await getVendor(req, res);
    const shop = await Shop.findOne({
      vendor: vendor._id.toString(),
    });
    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
    }
    const {
      page: pageQuery,
      limit: limitQuery,
      search: searchQuery,
    } = req.query;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;

    // Calculate skip correctly
    const skip = limit * (page - 1);

    const totalProducts = await Product.countDocuments({
      name: { $regex: searchQuery || '', $options: 'i' },
      ...(Boolean(shop) && { shop: shop._id }),
    });

    const products = await Product.aggregate([
      {
        $match: {
          ...(Boolean(shop) && { shop: shop._id }),
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
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
          available: 1,
          createdAt: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const createProductByVendor = async (req, res) => {
  try {
    const vendor = await getVendor(req, res);

    const { images, ...body } = req.body;

    const shop = await Shop.findOne({
      vendor: vendor._id.toString(),
    });

    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
    }
    if (shop.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'No Action Before You’re Approved',
      });
    }

    const updatedImages = await Promise.all(
      images.map(async (image) => {
        const blurDataURL = await blurDataUrl(image.url);
        return { ...image, blurDataURL };
      })
    );

    const data = await Product.create({
      ...body,
      shop: shop._id,
      images: updatedImages,
      likes: 0,
    });
    await Shop.findByIdAndUpdate(shop._id.toString(), {
      $addToSet: {
        products: data._id,
      },
    });
    res.status(201).json({
      success: true,
      message: 'Product Created',
      data: data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const getOneProductVendor = async (req, res) => {
  try {
    const vendor = await getVendor(req, res);
    const shop = await Shop.findOne({
      vendor: vendor._id.toString(),
    });
    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
    }

    const product = await Product.findOne({
      slug: req.params.slug,
      shop: shop._id,
    });
    const category = await Category.findById(product.category).select([
      'name',
      'slug',
    ]);
    const brand = await Brand.findById(product.brand).select('name');

    if (!product) {
      notFound();
    }
    const getProductRatingAndProductReviews = () => {
      return Product.aggregate([
        {
          $match: { slug: req.params.slug },
        },
        {
          $lookup: {
            from: 'productreviews',
            localField: 'reviews',
            foreignField: '_id',
            as: 'reviews',
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            rating: { $avg: '$reviews.rating' },
            totalProductReviews: { $size: '$reviews' },
          },
        },
      ]);
    };

    const reviewReport = await getProductRatingAndProductReviews();
    return res.status(201).json({
      success: true,
      data: product,
      totalRating: reviewReport[0]?.rating,
      totalProductReviews: reviewReport[0]?.totalProductReviews,
      brand: brand,
      category: category,
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
const updateProductByVendor = async (req, res) => {
  try {
    const vendor = await getVendor(req, res);
    const shop = await Shop.findOne({
      vendor: vendor._id.toString(),
    });
    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
    }
    const { slug } = req.params;
    const { images, ...body } = req.body;

    const updatedImages = await Promise.all(
      images.map(async (image) => {
        const blurDataURL = await blurDataUrl(image.url);
        return { ...image, blurDataURL };
      })
    );

    const updated = await Product.findOneAndUpdate(
      { slug: slug, shop: shop._id },
      {
        ...body,
        images: updatedImages,
        shop: shop._id,
      },
      { new: true, runValidators: true }
    );

    return res.status(201).json({
      success: true,
      data: updated,
      message: 'Product Updated',
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};
const deletedProductByVendor = async (req, res) => {
  try {
    const vendor = await getVendor(req, res);
    const shop = await Shop.findOne({
      vendor: vendor._id.toString(),
    });
    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
    }
    const slug = req.params.slug;
    const product = await Product.findOne({
      slug: slug,
      shop: shop._id,
    });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Vendor Product Not Found',
      });
    }
    // const length = product?.images?.length || 0;
    // for (let i = 0; i < length; i++) {
    //   await multiFilesDelete(product?.images[i]);
    // }
    if (product && product.images && product.images.length > 0) {
      await multiFilesDelete(product.images);
    }
    const deleteProduct = await Product.deleteOne({ slug: slug });
    await Shop.findByIdAndUpdate(shop._id.toString(), {
      $pull: {
        products: product._id,
      },
    });
    if (!deleteProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product Deletion Failed',
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Product Deleted ',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  createProductByVendor,
  getProductsByVendor,
  getOneProductVendor,
  updateProductByVendor,
  deletedProductByVendor,
};
