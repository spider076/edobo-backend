const Currency = require('../models/Currencies');

const getAdminCurrencies = async (request, response) => {
  try {
    const { page: pageQuery, limit: limitQuery } = request.query;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;

    // Calculate skip correctly
    const skip = limit * (page - 1);

    const currencies = await Currency.aggregate([
      {
        $sort: {
          available: -1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },

      {
        $project: {
          name: 1,
          code: 1,
          rate: 1,
          country: 1,
          status: 1,
          createdAt: 1,
        },
      },
    ]);

    response.status(200).json({
      success: true,
      data: currencies,
    });
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
};
const getCurrency = async (request, response) => {
  try {
    const currency = await Currency.findById(request.params.cid);

    response.status(200).json({
      success: true,
      data: currency,
      message: 'Currency created!',
    });
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
};
const createCurrency = async (request, response) => {
  try {
    const currency = await Currency.create({ ...request.body });

    response.status(200).json({
      success: true,
      data: currency,
      message: 'Currency created!',
    });
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
};
const updateCurrency = async (request, response) => {
  try {
    const currency = await Currency.findByIdAndUpdate(request.params.cid, {
      ...request.body,
    });

    response.status(200).json({
      success: true,
      data: currency,
      message: 'Currency updated!',
    });
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
};
const deleteCurrency = async (request, response) => {
  try {
    const currency = await Currency.findByIdAndDelete(request.params.cid, {
      ...request.body,
    });

    response.status(200).json({
      success: true,
      data: currency,
      message: 'Currency deleted!',
    });
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
};
const getUserCurrencies = async (request, response) => {
  try {
    const currencies = await Currency.aggregate([
      {
        $sort: {
          available: -1,
        },
      },

      {
        $project: {
          name: 1,
          code: 1,
          rate: 1,
          country: 1,
        },
      },
    ]);

    const data = await fetch(
      'https://api.exchangerate-api.com/v4/latest/USD'
    ).then((res) => res.json());
    const mapped = currencies.map((v) => {
      return { ...v, rate: v.rate || data.rates[v.code] };
    });
    response.status(200).json({
      success: true,
      data: mapped,
    });
  } catch (error) {
    response.status(400).json({ success: false, message: error.message });
  }
};
module.exports = {
  getAdminCurrencies,
  getCurrency,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  getUserCurrencies,
};
