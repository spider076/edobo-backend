const Products = require('../models/Product');
const Shop = require('../models/Shop');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const SubCategory = require('../models/SubCategory');

const Search = async (req, res) => {
  try {
    const { query, shop, subCategory, category } = req.body;
    const currenctShop = shop ? await Shop.findById(shop).select(['_id']) : '';
    const catId = category
      ? await Category.findById(category).select(['_id'])
      : '';
    const subCatId = subCategory
      ? await SubCategory.findById(subCategory).select(['_id'])
      : '';
    console.log(subCatId);
    const products = await Products.aggregate([
      {
        $match: {
          name: { $regex: query || '', $options: 'i' },
          ...(currenctShop && {
            shop: currenctShop._id,
          }),
          ...(catId && {
            category: catId._id,
          }),
          ...(catId &&
            subCatId && {
              subCategory: subCatId._id,
            }),

          status: { $ne: 'disabled' },
        },
      },
      {
        $lookup: {
          from: 'categories', // Assuming 'categories' is the name of your Category model collection
          localField: 'category', // Field in the Products model
          foreignField: '_id', // Field in the Category model
          as: 'categoryData',
        },
      },
      {
        $addFields: {
          category: { $arrayElemAt: ['$categoryData.name', 0] }, // Extracting the title from the categoryData array

          image: { $arrayElemAt: ['$images', 0] },
        },
      },

      {
        $project: {
          image: { url: '$image.url', blurDataURL: '$image.blurDataURL' },
          name: 1,
          priceSale: 1,
          slug: 1,
          _id: 1,
          category: 1, // Including the category field with only the title
        },
      },

      {
        $limit: 10,
      },
    ]);

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getFilters = async (req, res) => {
  try {
    await SubCategory.findOne();
    const categories = await Category.find()
      .select(['_id', 'name', 'slug', 'subCategories'])
      .populate({
        path: 'subCategories',
        select: ['_id', 'name', 'slug'],
      });

    const shops = await Shop.find().select(['_id', 'title', 'slug']);

    return res.status(200).json({
      success: true,
      categories,
      shops,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { Search, getFilters };
