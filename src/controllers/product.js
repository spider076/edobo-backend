const Brand = require('../models/Brand');
const Product = require('../models/Product');
const Shop = require('../models/Shop');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Compaign = require('../models/Compaign');
const _ = require('lodash');
const { multiFilesDelete } = require('../config/uploader');
const blurDataUrl = require('../config/getBlurDataURL');
const { getAdmin, getVendor } = require('../config/getUser');

const getProducts = async (req, res) => {
  try {
    const query = req.query;
    // Get shops in the specified city first
    const shopsInCity = query.city ? await Shop.find({
      'address.city': { $regex: new RegExp(query.city, 'i') }
    }).select('_id') : null;

    console.log('Found shops in city:', shopsInCity);

    // Check if city is specified but no shops found
    if (query.city && (!shopsInCity || shopsInCity.length === 0)) {
      console.log('No shops found in city:', query.city);
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
        count: 0,
      });
    }

    var newQuery = { ...query };
    delete newQuery.page;
    delete newQuery.limit;
    delete newQuery.prices;
    delete newQuery.sizes;
    delete newQuery.colors;
    delete newQuery.name;
    delete newQuery.date;
    delete newQuery.price;
    delete newQuery.top;
    delete newQuery.brand;
    delete newQuery.rate;
    delete newQuery.gender;
    delete newQuery.city;

    for (const [key, value] of Object.entries(newQuery)) {
      newQuery = { ...newQuery, [key]: value.split('_') };
    }

    // First get the brand if specified
    const brand = await Brand.findOne({
      slug: query.brand,
    }).select('slug');

    const skip = Number(query.limit) || 12;

    // Build match conditions for products
    const matchConditions = {
      ...newQuery,
      ...(Boolean(query.brand) && { brand: brand?._id }),
      ...(query.sizes && { sizes: { $in: query.sizes.split('_') } }),
      ...(query.colors && { colors: { $in: query.colors.split('_') } }),
      ...(query.city && shopsInCity?.length > 0 && {
        shop: { $in: shopsInCity.map(shop => shop._id) }
      }),
      status: { $ne: 'disabled' },
    };

    if (query.prices) {
      matchConditions.priceSale = {
        $gt: Number(query.prices.split('_')[0]) / Number(query.rate || 1),
        $lt: Number(query.prices.split('_')[1]) / Number(query.rate || 1),
      };
    }

    console.log('Match conditions:', JSON.stringify(matchConditions, null, 2));

    const totalProducts = await Product.countDocuments(matchConditions);

    const products = await Product.aggregate([
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
        $match: matchConditions
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          available: 1,
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
      {
        $sort: {
          ...((query.date && { createdAt: Number(query.date) }) ||
            (query.price && {
              priceSale: Number(query.price),
            }) ||
            (query.name && { name: Number(query.name) }) ||
            (query.top && { averageRating: Number(query.top) }) || {
            averageRating: -1,
          }),
        },
      },
      {
        $skip: Number(skip * parseInt(query.page ? query.page[0] - 1 : 0)),
      },
      {
        $limit: Number(skip),
      },
    ]);

    console.log('Found products:', products.length);
    console.log('Total products:', totalProducts);

    res.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / skip),
    });
  } catch (error) {
    console.error('Error in getProducts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
const getProductsByCategory = async (req, res) => {
  try {
    const query = req.query; // Extract query params from request

    var newQuery = { ...query };
    delete newQuery.page;
    delete newQuery.limit;
    delete newQuery.prices;
    delete newQuery.sizes;
    delete newQuery.colors;
    delete newQuery.name;
    delete newQuery.date;
    delete newQuery.price;
    delete newQuery.top;
    delete newQuery.brand;
    delete newQuery.rate;
    delete newQuery.gender;
    for (const [key, value] of Object.entries(newQuery)) {
      newQuery = { ...newQuery, [key]: value.split('_') };
    }
    const brand = await Brand.findOne({
      slug: query.brand,
    }).select('slug');
    const category = await Category.findOne({
      slug: req.params.category,
    }).select('slug');

    const skip = Number(query.limit) || 12;
    const totalProducts = await Product.countDocuments({
      ...newQuery,
      ...(Boolean(query.brand) && { brand: brand._id }),
      category: category._id,
      // ...(Boolean(req.params.category) && { category: category._id }),
      ...(query.sizes && { sizes: { $in: query.sizes.split('_') } }),
      ...(query.colors && { colors: { $in: query.colors.split('_') } }),

      priceSale: {
        $gt: query.prices
          ? Number(query.prices.split('_')[0]) / Number(query.rate)
          : 1,
        $lt: query.prices
          ? Number(query.prices.split('_')[1]) / Number(query.rate)
          : 1000000,
      },
      status: { $ne: 'disabled' },
    }).select(['']);

    const minPrice = query.prices
      ? Number(query.prices.split('_')[0]) / Number(query.rate)
      : 1;
    const maxPrice = query.prices
      ? Number(query.prices.split('_')[1]) / Number(query.rate)
      : 10000000;

    const products = await Product.aggregate([
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
          category: category._id,
          // ...(Boolean(req.params.category) && {
          //   category: category._id,
          // }),
          ...(Boolean(query.brand) && {
            brand: brand._id,
          }),
          ...(query.isFeatured && {
            isFeatured: Boolean(query.isFeatured),
          }),

          ...(query.gender && {
            gender: { $in: query.gender.split('_') },
          }),
          ...(query.sizes && {
            sizes: { $in: query.sizes.split('_') },
          }),

          ...(query.colors && {
            colors: { $in: query.colors.split('_') },
          }),
          ...(query.prices && {
            priceSale: {
              $gt: minPrice,
              $lt: maxPrice,
            },
          }),
          status: { $ne: 'disabled' },
        },
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          available: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          available: 1,
          price: 1,
          averageRating: 1,
          vendor: 1,
          shop: 1,
          createdAt: 1,
        },
      },
      {
        $sort: {
          ...((query.date && { createdAt: Number(query.date) }) ||
            (query.price && {
              priceSale: Number(query.price),
            }) ||
            (query.name && { name: Number(query.name) }) ||
            (query.top && { averageRating: Number(query.top) }) || {
            averageRating: -1,
          }),
        },
      },
      {
        $skip: Number(skip * parseInt(query.page ? query.page[0] - 1 : 0)),
      },
      {
        $limit: Number(skip),
      },
    ]);

    res.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / skip),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
const getProductsByCompaign = async (req, res) => {
  try {
    const query = req.query; // Extract query params from request

    var newQuery = { ...query };
    delete newQuery.page;
    delete newQuery.limit;
    delete newQuery.name;
    delete newQuery.date;
    delete newQuery.price;
    delete newQuery.top;
    delete newQuery.rate;
    for (const [key, value] of Object.entries(newQuery)) {
      newQuery = { ...newQuery, [key]: value.split('_') };
    }
    const compaign = await Compaign.findOne({
      slug: req.params.slug,
    });
    const skip = Number(query.limit) || 12;
    const totalProducts = await Product.countDocuments({
      _id: { $in: compaign.products },
      status: { $ne: 'disabled' },
    }).select(['']);

    const products = await Product.aggregate([
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
          _id: { $in: compaign.products },
          status: { $ne: 'disabled' },
        },
      },
      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          available: 1,
          slug: 1,
          colors: 1,
          discount: 1,
          likes: 1,
          priceSale: 1,
          available: 1,
          price: 1,
          averageRating: 1,
          vendor: 1,
          shop: 1,
          createdAt: 1,
        },
      },
      {
        $sort: {
          ...((query.date && { createdAt: Number(query.date) }) ||
            (query.price && {
              priceSale: Number(query.price),
            }) ||
            (query.name && { name: Number(query.name) }) ||
            (query.top && { averageRating: Number(query.top) }) || {
            averageRating: -1,
          }),
        },
      },
      {
        $skip: Number(skip * parseInt(query.page ? query.page[0] - 1 : 0)),
      },
      {
        $limit: Number(skip),
      },
    ]);

    res.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / skip),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
const getProductsBySubCategory = async (req, res) => {
  try {
    const query = req.query; // Extract query params from request

    var newQuery = { ...query };
    delete newQuery.page;
    delete newQuery.limit;
    delete newQuery.prices;
    delete newQuery.sizes;
    delete newQuery.colors;
    delete newQuery.name;
    delete newQuery.date;
    delete newQuery.price;
    delete newQuery.top;
    delete newQuery.brand;
    delete newQuery.rate;
    delete newQuery.gender;
    for (const [key, value] of Object.entries(newQuery)) {
      newQuery = { ...newQuery, [key]: value.split('_') };
    }
    const brand = await Brand.findOne({
      slug: query.brand,
    }).select('slug');
    const subCategory = await SubCategory.findOne({
      slug: req.params.subcategory,
    }).select('slug');

    const skip = Number(query.limit) || 12;
    const totalProducts = await Product.countDocuments({
      ...newQuery,
      ...(Boolean(query.brand) && { brand: brand._id }),
      subCategory: subCategory._id,
      // ...(Boolean(req.params.subcategory) && { subCategory: subCategory._id }),
      ...(query.sizes && { sizes: { $in: query.sizes.split('_') } }),
      ...(query.colors && { colors: { $in: query.colors.split('_') } }),

      priceSale: {
        $gt: query.prices
          ? Number(query.prices.split('_')[0]) / Number(query.rate)
          : 1,
        $lt: query.prices
          ? Number(query.prices.split('_')[1]) / Number(query.rate)
          : 1000000,
      },
      status: { $ne: 'disabled' },
    }).select(['']);
    const minPrice = query.prices
      ? Number(query.prices.split('_')[0]) / Number(query.rate)
      : 1;
    const maxPrice = query.prices
      ? Number(query.prices.split('_')[1]) / Number(query.rate)
      : 10000000;

    const products = await Product.aggregate([
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
          subCategory: subCategory._id,
          // ...(Boolean(req.params.subcategory) && {
          //   subCategory: subCategory._id,
          // }),
          ...(Boolean(query.brand) && {
            brand: brand._id,
          }),
          ...(query.isFeatured && {
            isFeatured: Boolean(query.isFeatured),
          }),

          ...(query.gender && {
            gender: { $in: query.gender.split('_') },
          }),
          ...(query.sizes && {
            sizes: { $in: query.sizes.split('_') },
          }),

          ...(query.colors && {
            colors: { $in: query.colors.split('_') },
          }),
          ...(query.prices && {
            priceSale: {
              $gt: minPrice,
              $lt: maxPrice,
            },
          }),
          status: { $ne: 'disabled' },
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
          available: 1,
          averageRating: 1,
          vendor: 1,
          shop: 1,
          createdAt: 1,
        },
      },
      {
        $sort: {
          ...((query.date && { createdAt: Number(query.date) }) ||
            (query.price && {
              priceSale: Number(query.price),
            }) ||
            (query.name && { name: Number(query.name) }) ||
            (query.top && { averageRating: Number(query.top) }) || {
            averageRating: -1,
          }),
        },
      },
      {
        $skip: Number(skip * parseInt(query.page ? query.page[0] - 1 : 0)),
      },
      {
        $limit: Number(skip),
      },
    ]);

    res.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / skip),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
const getProductsByShop = async (req, res) => {
  try {
    const query = req.query; // Extract query params from request

    var newQuery = { ...query };
    delete newQuery.page;
    delete newQuery.limit;
    delete newQuery.prices;
    delete newQuery.sizes;
    delete newQuery.colors;
    delete newQuery.name;
    delete newQuery.date;
    delete newQuery.price;
    delete newQuery.top;
    delete newQuery.brand;
    delete newQuery.rate;
    delete newQuery.gender;

    for (const [key, value] of Object.entries(newQuery)) {
      newQuery = { ...newQuery, [key]: value.split('_') };
    }
    const brand = await Brand.findOne({
      slug: query.brand,
    }).select('slug');
    const shop = await Shop.findOne({
      slug: req.params.shop,
    }).select('slug');

    const skip = Number(query.limit) || 12;
    const totalProducts = await Product.countDocuments({
      ...newQuery,
      shop: shop._id,
      ...(Boolean(query.brand) && { brand: brand._id }),
      ...(query.sizes && { sizes: { $in: query.sizes.split('_') } }),
      ...(query.colors && { colors: { $in: query.colors.split('_') } }),

      priceSale: {
        $gt: query.prices
          ? Number(query.prices.split('_')[0]) / Number(query.rate)
          : 1,
        $lt: query.prices
          ? Number(query.prices.split('_')[1]) / Number(query.rate)
          : 1000000,
      },
      status: { $ne: 'disabled' },
    }).select(['']);

    const minPrice = query.prices
      ? Number(query.prices.split('_')[0]) / Number(query.rate)
      : 1;
    const maxPrice = query.prices
      ? Number(query.prices.split('_')[1]) / Number(query.rate)
      : 10000000;

    const products = await Product.aggregate([
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
          shop: shop._id,
          ...(Boolean(query.brand) && {
            brand: brand._id,
          }),

          ...(query.isFeatured && {
            isFeatured: Boolean(query.isFeatured),
          }),

          ...(query.gender && {
            gender: { $in: query.gender.split('_') },
          }),
          ...(query.sizes && {
            sizes: { $in: query.sizes.split('_') },
          }),

          ...(query.colors && {
            colors: { $in: query.colors.split('_') },
          }),
          ...(query.prices && {
            priceSale: {
              $gt: minPrice,
              $lt: maxPrice,
            },
          }),
          status: { $ne: 'disabled' },
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
          available: 1,
          shop: 1,
          createdAt: 1,
        },
      },
      {
        $sort: {
          ...((query.date && { createdAt: Number(query.date) }) ||
            (query.price && {
              priceSale: Number(query.price),
            }) ||
            (query.name && { name: Number(query.name) }) ||
            (query.top && { averageRating: Number(query.top) }) || {
            averageRating: -1,
          }),
        },
      },
      {
        $skip: Number(skip * parseInt(query.page ? query.page[0] - 1 : 0)),
      },
      {
        $limit: Number(skip),
      },
    ]);

    res.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / skip),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

const getFilters = async (req, res) => {
  try {
    const totalProducts = await Product.find({
      status: { $ne: 'disabled' },
    }).select(['colors', 'sizes', 'gender', 'price']);
    const Shops = await Shop.find({
      status: { $ne: 'disabled' },
    }).select(['title']);
    const brands = await Brand.find({
      status: { $ne: 'disabled' },
    }).select(['name', 'slug']);
    const total = totalProducts.map((item) => item.gender);
    const totalGender = total.filter((item) => item !== '');
    function onlyUnique(value, index, array) {
      return array.indexOf(value) === index;
    }
    const mappedColors = totalProducts?.map((v) => v.colors);
    const mappedSizes = totalProducts?.map((v) => v.sizes);
    const mappedPrices = totalProducts?.map((v) => v.price);
    const min = mappedPrices[0] ? Math.min(...mappedPrices) : 0;
    const max = mappedPrices[0] ? Math.max(...mappedPrices) : 100000;
    const response = {
      colors: _.union(...mappedColors),
      sizes: _.union(...mappedSizes),
      prices: [min, max],
      genders: totalGender.filter(onlyUnique),
      brands: brands,
      Shops: Shops,
    };
    res.status(200).json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};
const getProductsByAdmin = async (request, response) => {
  try {
    const {
      page: pageQuery,
      limit: limitQuery,
      search: searchQuery,
      shop,
      category,
      brand,
    } = request.query;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;

    // Calculate skip correctly
    const skip = limit * (page - 1);

    let matchQuery = {};

    if (shop) {
      const currentShop = await Shop.findOne({
        slug: shop,
      }).select(['slug', '_id']);

      matchQuery.shop = currentShop._id;
    }
    if (category) {
      const currentCategory = await Category.findOne({
        slug: category,
      }).select(['slug', '_id']);

      matchQuery.category = currentCategory._id;
    }
    if (brand) {
      const currentBrand = await Brand.findOne({
        slug: brand,
      }).select(['slug', '_id']);

      matchQuery.brand = currentBrand._id;
    }

    const totalProducts = await Product.countDocuments({
      name: { $regex: searchQuery || '', $options: 'i' },
      ...matchQuery,
    });

    const products = await Product.aggregate([
      {
        $match: {
          ...matchQuery,
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

    response.status(200).json({
      success: true,
      data: products,
      total: totalProducts,
      count: Math.ceil(totalProducts / limit),
      currentPage: page,
    });
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
};
const createProductByAdmin = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);

    const { images, ...body } = req.body;

    const updatedImages = await Promise.all(
      images.map(async (image) => {
        const blurDataURL = await blurDataUrl(image.url);
        return { ...image, blurDataURL };
      })
    );
    const data = await Product.create({
      vendor: admin._id,
      ...body,
      images: updatedImages,
      likes: 0,
    });
    await Shop.findByIdAndUpdate(req.body.shop, {
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

const getOneProductByAdmin = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    const category = await Category.findById(product.category).select([
      'name',
      'slug',
    ]);
    const brand = await Brand.findById(product.brand).select('name');

    const getProductRatingAndProductReviews = () => {
      return Product.aggregate([
        {
          $match: { slug: req.params.slug },
        },
        {
          $lookup: {
            from: 'productreviews',
            localField: '_id',
            foreignField: 'reviews',
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
const updateProductByAdmin = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);
    const { slug } = req.params;
    const { images, ...body } = req.body;

    const updatedImages = await Promise.all(
      images.map(async (image) => {
        const blurDataURL = await blurDataUrl(image.url);
        return { ...image, blurDataURL };
      })
    );

    const updated = await Product.findOneAndUpdate(
      { slug: slug, vendor: admin._id },
      {
        ...body,
        images: updatedImages,
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
async function deletedProductByAdmin(req, res) {
  try {
    const slug = req.params.slug;
    const product = await Product.findOne({ slug: slug });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product Not Found',
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
    if (!deleteProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product Deletion Failed',
      });
    }
    await Shop.findByIdAndUpdate(req.body.shop, {
      $pull: {
        products: product._id,
      },
    });
    return res.status(200).json({
      success: true,
      message: 'Product Deleted ',
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

const getFiltersByCategory = async (req, res) => {
  try {
    const { shop, category } = req.params;
    // Fetch shop data
    const shopData = await Shop.findOne({ slug: shop }).select(['_id']);
    console.log('Shop Data:', shopData); // Log shop data
    if (!shopData) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop Not Found' });
    }

    // Fetch category data
    const categoryData = await Category.findOne({ slug: category }).select([
      '_id',
      'name',
    ]);
    if (!categoryData) {
      return res
        .status(404)
        .json({ success: false, message: 'Category Not Found' });
    }
    // Fetch products for the category under the specified shop
    const products = await Product.find({
      status: { $ne: 'disabled' },
      category: categoryData._id,
      shop: shopData._id,
    }).select(['colors', 'sizes', 'gender', 'price', 'brand']);

    // Extract unique values for colors, sizes, gender, and prices
    const colors = [
      ...new Set(products.flatMap((product) => product.colors || [])),
    ];
    const sizes = [
      ...new Set(products.flatMap((product) => product.sizes || [])),
    ];
    const genders = [
      ...new Set(products.flatMap((product) => product.gender || [])),
    ];
    const prices = products.flatMap((product) => product.price || []);
    const minPrice = Math.min(...prices, 0); // Calculate min price
    const maxPrice = Math.max(...prices, 100000); // Calculate max price

    // Extract unique brands
    const brands = [...new Set(products.map((product) => product.brand))];

    // Query the Brand collection to get additional information for brands
    const brandData = await Brand.find({ _id: { $in: brands } }).select([
      '_id',
      'slug',
      'name',
    ]);

    // Construct the response object
    const response = {
      colors,
      sizes,
      prices: [minPrice, maxPrice],
      genders,
      brands: brandData,
    };

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFiltersBySubCategory = async (req, res) => {
  try {
    const { shop, category, subcategory } = req.params;

    // Fetch shop data
    const shopData = await Shop.findOne({ slug: shop }).select(['_id']);
    if (!shopData) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop Not Found' });
    }
    const categoryData = await Category.findOne({ slug: category }).select([
      '_id',
      'name',
    ]);
    if (!categoryData) {
      return res
        .status(404)
        .json({ success: false, message: 'Category Not Found' });
    }
    // Fetch subcategory data
    const subcategoryData = await SubCategory.findOne({
      slug: subcategory,
      parentCategory: categoryData._id,
    }).select(['_id']);
    if (!subcategoryData) {
      return res
        .status(404)
        .json({ success: false, message: 'Subcategory Not Found' });
    }

    // Fetch products for the subcategory under the specified shop
    const products = await Product.find({
      status: { $ne: 'disabled' },
      subCategory: subcategoryData._id,
      shop: shopData._id,
    }).select(['colors', 'sizes', 'gender', 'price', 'brand']);

    // Extract unique values for colors, sizes, gender, and prices
    const colors = [
      ...new Set(products.flatMap((product) => product.colors || [])),
    ];
    const sizes = [
      ...new Set(products.flatMap((product) => product.sizes || [])),
    ];
    const genders = [
      ...new Set(products.flatMap((product) => product.gender || [])),
    ];
    const prices = products.flatMap((product) => product.price || []);
    const minPrice = Math.min(...prices, 0); // Calculate min price
    const maxPrice = Math.max(...prices, 100000); // Calculate max price

    // Extract unique brands
    const brands = [...new Set(products.map((product) => product.brand))];

    // Query the Brand collection to get additional information for brands
    const brandData = await Brand.find({ _id: { $in: brands } }).select([
      '_id',
      'slug',
      'name',
    ]);

    // Construct the response object
    const response = {
      colors,
      sizes,
      prices: [minPrice, maxPrice],
      genders,
      brands: brandData,
    };

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFiltersByShop = async (req, res) => {
  try {
    const { shop } = req.params;

    // Query the Shop collection to find the shop data
    const shopData = await Shop.findOne({ slug: shop }).select([
      'title',
      'slug',
    ]);
    if (!shopData) {
      return res
        .status(404)
        .json({ success: false, message: 'Shop Not Found' });
    }

    // Query the Product collection to find products related to the shop
    const products = await Product.find({
      status: { $ne: 'disabled' },
      shop: shopData._id,
    }).select(['colors', 'sizes', 'gender', 'price', 'brand']);

    // Extract unique values for colors, sizes, gender, and prices
    const colors = [
      ...new Set(products.flatMap((product) => product.colors || [])),
    ];
    const sizes = [
      ...new Set(products.flatMap((product) => product.sizes || [])),
    ];
    const genders = [
      ...new Set(products.flatMap((product) => product.gender || [])),
    ];
    const prices = products.flatMap((product) => product.price || []);
    const minPrice = Math.min(...prices, 0); // Calculate min price
    const maxPrice = Math.max(...prices, 100000); // Calculate max price

    // Extract unique brands
    const brands = [...new Set(products.map((product) => product.brand))];

    // Remove any undefined or null values from brands array
    const cleanBrands = brands.filter(Boolean);

    // Query the Brand collection to get additional information for brands
    const brandData = await Brand.find({ _id: { $in: cleanBrands } }).select([
      '_id',
      'slug',
      'name',
    ]);

    // Construct the response object
    const response = {
      colors,
      sizes,
      prices: [minPrice, maxPrice],
      genders,
      brands: brandData,
    };

    res.status(200).json({ success: true, data: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllProductSlug = async (req, res) => {
  try {
    const products = await Product.find().select('slug');

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const relatedProducts = async (req, res) => {
  try {
    const pid = req.params.pid;
    const product = await Product.findById(pid).select('_id category');

    const related = await Product.aggregate([
      {
        $lookup: {
          from: 'reviews',
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
          category: product.category,
          _id: { $ne: product._id },
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
          available: 1,
          priceSale: 1,
          price: 1,
          averageRating: 1,
          vendor: 1,
          shop: 1,
          createdAt: 1,
        },
      },
    ]);

    res.status(200).json({ success: true, data: related });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getOneProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug });
    const category = await Category.findById(product.category).select([
      'name',
      'slug',
    ]);
    const brand = await Brand.findById(product.brand).select('name');

    const getProductRatingAndReviews = async () => {
      const product = await Product.aggregate([
        {
          $match: { slug: req.params.slug },
        },
        {
          $lookup: {
            from: 'productreviews', // Replace with your actual review model name
            localField: 'reviews', // Replace with the field referencing product in reviews
            foreignField: '_id', // Replace with the field referencing product in reviews
            as: 'reviews',
          },
        },
        {
          $project: {
            _id: 0, // Exclude unnecessary fields if needed
            totalReviews: { $size: '$reviews' }, // Count total reviews
            averageRating: {
              $avg: '$reviews.rating', // Calculate average rating (optional)
            },
          },
        },
      ]);

      return product[0];
    };

    const reviewReport = await getProductRatingAndReviews();
    return res.status(201).json({
      success: true,
      data: product,
      totalReviews: reviewReport.totalReviews,
      totalRating: reviewReport.averageRating || 0,
      brand: brand,
      category: category,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
const getCompareProducts = async (req, res) => {
  try {
    const fetchedProducts = await Product.find({
      _id: { $in: req.body.products },
    }).select(['_id']);
    const products = await Product.aggregate([
      {
        $match: {
          _id: { $in: fetchedProducts.map((v) => v._id) },
        },
      },
      {
        $lookup: {
          from: 'productreviews', // Replace with your actual review model name
          localField: 'reviews', // Replace with the field referencing product in reviews
          foreignField: '_id', // Replace with the field referencing product in reviews
          as: 'reviews',
        },
      },
      {
        $lookup: {
          from: 'brands', // Replace with your actual review model name
          localField: 'brand', // Replace with the field referencing product in reviews
          foreignField: '_id', // Replace with the field referencing product in reviews
          as: 'brand',
        },
      },
      {
        $lookup: {
          from: 'shops', // Replace with your actual review model name
          localField: 'shop', // Replace with the field referencing product in reviews
          foreignField: '_id', // Replace with the field referencing product in reviews
          as: 'shop',
        },
      },
      {
        $addFields: {
          averageRating: { $avg: '$reviews.rating' },
          image: { $arrayElemAt: ['$images', 0] },
          brandName: { $arrayElemAt: ['$brand.name', 0] },
          shopName: { $arrayElemAt: ['$shop.title', 0] },
        },
      },
      {
        $project: {
          _id: 1, // Exclude unnecessary fields if needed
          brandName: 1,
          shopName: 1,
          slug: 1,
          available: 1,
          name: 1,
          sizes: 1,
          colors: 1,
          priceSale: 1,
          price: 1,
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          totalReviews: { $size: '$reviews' }, // Count total reviews
          averageRating: 1,
        },
      },
    ]);
    return res.status(201).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProducts,
  getProductsByCategory,
  getProductsBySubCategory,
  getProductsByShop,
  getFilters,
  getProductsByAdmin,
  createProductByAdmin,
  getOneProductByAdmin,
  updateProductByAdmin,
  deletedProductByAdmin,
  getFiltersByCategory,
  getFiltersByShop,
  getAllProductSlug,
  getFiltersBySubCategory,
  relatedProducts,
  getOneProductBySlug,
  getProductsByCompaign,
  getCompareProducts,
};
