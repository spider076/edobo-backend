const Payment = require('../models/Payment');
const Shop = require('../models/Shop');
const Orders = require('../models/Order');
const { getVendor } = require('../config/getUser');
const moment = require('moment');
const getPaymentsByAdmin = async (req, res) => {
  try {
    let { limit, page = 1, shop, status } = req.query;

    const skip = parseInt(limit) || 8;
    let query = {};

    // Add shopid filter if provided
    if (shop) {
      const currentShop = await Shop.findOne({ slug: shop }).select(['_id']);
      query.shop = currentShop._id;
    }

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    const totalPayments = await Payment.countDocuments(query);

    const payments = await Payment.find(query)
      .skip(skip * (parseInt(page) - 1 || 0))
      .limit(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
      count: Math.ceil(totalPayments / skip),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Create payment
const createPayment = async (req, res) => {
  try {
    const newPayment = await Payment.create(req.body);
    res
      .status(201)
      .json({ success: true, message: 'Payment created', data: newPayment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// update payment
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    // Find the existing payment
    const existingPayment = await Payment.findById(id);

    if (!existingPayment) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    const updatedPayment = await Payment.findByIdAndUpdate(
      id,
      { ...req.body },
      {
        new: true,
      }
    );

    if (!updatedPayment) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Payment updated',
      data: updatedPayment,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete payment
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPayment = await Payment.findByIdAndDelete(id);
    if (!deletedPayment) {
      return res
        .status(404)
        .json({ success: false, message: 'Payment not found' });
    }
    res.status(200).json({ success: true, message: 'Payment deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const getPaymentsByVender = async (req, res) => {
  try {
    const vendor = await getVendor(req, res);
    if (!vendor) {
      return res.status(400).json({ success: false, message: 'Not Allowed' });
    }
    const { limit, page = 1 } = req.query;

    const skip = parseInt(limit) || 8;
    const totalPayments = await Payment.find().countDocuments();
    const payments = await Payment.find()
      .skip(skip * (parseInt(page) - 1 || 0))
      .limit(skip)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
      count: Math.ceil(totalPayments / skip),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getPaymentDetailsById = async (req, res) => {
  try {
    const { pid } = req.params;
    const { page = 1, limit = 10 } = req.query; // Set default values for page and limit

    const payment = await Payment.findOne({
      _id: pid,
    })
      .populate({
        path: 'shop',
        select: [
          'title',
          'cover',
          'logo',
          'approved',
          'approvedAt',
          'description',
          'status',
          'phone',
          'address',
        ],
      })
      .populate({
        path: 'orders',
        select: [
          'items',
          'createdAt',
          'total',
          'status',
          'paymentMethod',
          'user',
        ],
      });

    const orders = payment.orders || []; // Handle case where 'orders' might be empty

    // Pagination logic
    const totalOrders = orders.length;
    const start = (parseInt(page) - 1) * parseInt(limit);
    const end = Math.min(start + parseInt(limit), totalOrders);
    const paginatedOrders = orders.slice(start, end);
    const { totalCommission, totalIncome, status, paidAt, date } = payment;
    res.status(200).json({
      success: true,
      payment: {
        totalCommission,
        totalIncome,
        status,
        paidAt,
        date,
      },
      shop: payment.shop,
      data: {
        data: paginatedOrders,
        total: totalOrders,
        count: Math.ceil(totalOrders / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { pid, sid } = req.params;
    const { status } = req.body;

    const payment = await Payment.findOneAndUpdate(
      {
        shop: sid,
        _id: pid,
      },
      {
        status,
      }
    );

    if (!payment) {
      res.status(404).json({ success: false, message: 'Not found' });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const getPayoutsByAdmin = async (req, res) => {
  try {
    const { shop, status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const count = await Payment.countDocuments({
      ...(shop && { shop }),
      ...(status && { status }),
    });
    const payments = await Payment.find({
      ...(shop && { shop }),
      ...(status && { status }),
    })
      .populate({ path: 'shop', select: ['logo', 'title'] })
      .skip(limit * (parseInt(page) - 1))
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
      count: Math.ceil(count / limit),
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
const lastMonthOrders = async (shopId) => {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const pipeline = [
    {
      $match: {
        'items.shop': shopId,
        status: 'delivered',
        createdAt: {
          $gte: lastMonth, // Filter orders created after or on last month's first day
          $lt: firstDayThisMonth, // Filter orders created before this month's first day
        },
      },
    },
    {
      $project: {
        // Existing projection fields (if any)
        month: { $month: '$createdAt' },
        year: { $year: '$createdAt' },
        income: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$items',
                  as: 'item',
                  cond: { $eq: ['$$item.shop', shopId] },
                },
              },
              as: 'item',
              in: { $multiply: ['$$item.quantity', '$$item.priceSale'] }, // Calculate income per item
            },
          },
        },
        orderId: '$_id',
      },
    },
    {
      $group: {
        _id: {
          month: '$month',
          year: '$year',
        },
        orders: { $push: '$$ROOT' },
        totalIncome: { $sum: '$income' },
      },
    },
  ];

  const result = await Orders.aggregate(pipeline);

  const lastMonthTotal = result[0] || null;
  return lastMonthTotal;
};
const thisMonthOrders = async (shopId) => {
  const today = new Date();
  const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const tomorrow = new Date(today.getFullYear(), today.getMonth() + 1, 1); // Start of next month
  const pipeline = [
    {
      $match: {
        'items.shop': shopId,
        status: 'delivered',
        createdAt: {
          $gte: firstDayThisMonth,
          $lt: tomorrow,
        },
      },
    },
    {
      $project: {
        // Existing projection fields (if any)
        month: { $month: '$createdAt' },
        year: { $year: '$createdAt' },
        income: {
          $sum: {
            $map: {
              input: {
                $filter: {
                  input: '$items',
                  as: 'item',
                  cond: { $eq: ['$$item.shop', shopId] },
                },
              },
              as: 'item',
              in: { $multiply: ['$$item.quantity', '$$item.priceSale'] }, // Calculate income per item
            },
          },
        },
        orderId: '$_id',
      },
    },
    {
      $group: {
        _id: {
          month: '$month',
          year: '$year',
        },
        orders: { $push: '$$ROOT' },
        totalIncome: { $sum: '$income' },
      },
    },
  ];
  const result = await Orders.aggregate(pipeline);
  const thisMonthTotal = result[0] || null;
  return thisMonthTotal;
};
function isSameMonth(date1, date2) {
  // Check if both dates have values
  if (!date1 || !date2) {
    return false;
  }

  // Extract year and month values
  const year1 = date1.getFullYear();
  const month1 = date1.getMonth(); // Months are zero-indexed (January = 0)
  const year2 = date2.getFullYear();
  const month2 = date2.getMonth();

  // Compare year and month
  return year1 === year2 && month1 === month2;
}
const getIncomeByShop = async (req, res) => {
  try {
    const shop = await Shop.findOne({
      slug: req.params.slug,
    });
    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
    }
    const { limit = 10, page = 1 } = req.query;

    const skip = parseInt(limit) * (parseInt(page) - 1) || 0;

    function getTotalAfterComission(param) {
      const commissionRate = process.env.COMMISSION / 100;
      const finalPaymentAfterComission = param * (1 - commissionRate);
      return finalPaymentAfterComission;
    }
    function getComission(param) {
      const commissionRate = process.env.COMMISSION / 100;
      const finalPaymentAfterComission = param * (1 - commissionRate);

      const totalComission = param - finalPaymentAfterComission;
      return totalComission;
    }

    const count = await Payment.countDocuments({
      shop: shop._id,
    });

    const allPayments = await Payment.find({
      shop: shop._id,
    })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: 1 });

    const lastMonthTotal = await lastMonthOrders(shop._id);
    const thisMonthTotal = await thisMonthOrders(shop._id);
    const today = new Date();

    const lastMonthDate = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );

    const month = today.getMonth(); // Months are zero-indexed (January = 0)
    const year = today.getFullYear();

    // Calculate last month's dates
    const lastMonth = month === 0 ? 11 : month - 1; // Handle January as December of previous year
    const lastYear = month === 0 ? year - 1 : year;

    // Define the start and end dates for the last month
    const startDate = new Date(lastYear, lastMonth, 1);
    const endDate = new Date(lastYear, lastMonth + 1, 0); // Go to the last day of the last month (day 0)
    const lastMonthPaymentDate = await Payment.findOne({
      shop: shop._id,
      date: {
        $gte: startDate, // Greater than or equal to start of the month
        $lt: endDate, // Less than the end of the month (next month's 1st day)
      },
    }).select('createdAt');
    const lastMonthPayment = {
      date: new Date(
        `${lastMonthTotal?._id?.year ||
          lastMonthDate.getFullYear()} ${lastMonthTotal?._id?.month ||
          lastMonthDate.getMonth() + 1}`
      ), // Use timestamp for accurate date
      orders: lastMonthTotal?.orders.map((v) => v._id),
      shop: shop._id,
      total: lastMonthTotal?.totalIncome || 0,
      totalIncome: Number(
        getTotalAfterComission(lastMonthTotal?.totalIncome || 0)?.toFixed(1)
      ),
      totalCommission: Number(
        getComission(lastMonthTotal?.totalIncome || 0)?.toFixed(1)
      ),
      status: 'pending',
    };

    const thisMonthPayment = {
      date: new Date(
        `${thisMonthTotal?._id?.year ||
          new Date().getFullYear()} ${thisMonthTotal?._id?.month ||
          new Date().getMonth() + 1}`
      ), // Use timestamp for accurate date
      orders: thisMonthTotal?.orders.map((v) => v._id),
      shop: shop._id,
      total: thisMonthTotal?.totalIncome,
      totalIncome: Number(
        getTotalAfterComission(thisMonthTotal?.totalIncome)?.toFixed(1)
      ),
      totalCommission: Number(
        getComission(thisMonthTotal?.totalIncome)?.toFixed(1)
      ),
      status: 'pending',
      thisMonth: true,
    };

    return res.status(200).json({
      success: true,
      data: [
        thisMonthPayment,
        !lastMonthPaymentDate && { ...lastMonthPayment },
        ...allPayments,
      ].filter((v) => Boolean(v)),
      total: count,
      count: Math.ceil(count / parseInt(limit)),
      currentPage: page,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getIncomeByvendor = async (req, res) => {
  try {
    const shop = await Shop.findOne({
      vendor: req.user._id,
    });
    if (!shop) {
      res.status(404).json({ success: false, message: 'Shop not found' });
    }
    const { limit = 10, page = 1 } = req.query;

    const skip = parseInt(limit) * (parseInt(page) - 1) || 0;

    function getTotalAfterComission(param) {
      const commissionRate = process.env.COMMISSION / 100;
      const finalPaymentAfterComission = param * (1 - commissionRate);
      return finalPaymentAfterComission;
    }
    function getComission(param) {
      const commissionRate = process.env.COMMISSION / 100;
      const finalPaymentAfterComission = param * (1 - commissionRate);

      const totalComission = param - finalPaymentAfterComission;
      return totalComission;
    }

    const count = await Payment.countDocuments({
      shop: shop._id,
    });

    const allPayments = await Payment.find({
      shop: shop._id,
    })
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: 1 });

    const lastMonthTotal = await lastMonthOrders(shop._id);
    const thisMonthTotal = await thisMonthOrders(shop._id);
    const today = new Date();

    const lastMonthDate = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );

    const month = today.getMonth(); // Months are zero-indexed (January = 0)
    const year = today.getFullYear();

    // Calculate last month's dates
    const lastMonth = month === 0 ? 11 : month - 1; // Handle January as December of previous year
    const lastYear = month === 0 ? year - 1 : year;

    // Define the start and end dates for the last month
    const startDate = new Date(lastYear, lastMonth, 1);
    const endDate = new Date(lastYear, lastMonth + 1, 0); // Go to the last day of the last month (day 0)
    const lastMonthPaymentDate = await Payment.findOne({
      shop: shop._id,
      date: {
        $gte: startDate, // Greater than or equal to start of the month
        $lt: endDate, // Less than the end of the month (next month's 1st day)
      },
    }).select('createdAt');
    const lastMonthPayment = {
      date: new Date(
        `${lastMonthTotal?._id?.year ||
          lastMonthDate.getFullYear()} ${lastMonthTotal?._id?.month ||
          lastMonthDate.getMonth() + 1}`
      ), // Use timestamp for accurate date
      orders: lastMonthTotal?.orders.map((v) => v._id),
      shop: shop._id,
      total: lastMonthTotal?.totalIncome || 0,
      totalIncome: Number(
        getTotalAfterComission(lastMonthTotal?.totalIncome || 0)?.toFixed(1)
      ),
      totalCommission: Number(
        getComission(lastMonthTotal?.totalIncome || 0)?.toFixed(1)
      ),
      status: 'pending',
    };

    const thisMonthPayment = {
      date: new Date(
        `${thisMonthTotal?._id?.year ||
          new Date().getFullYear()} ${thisMonthTotal?._id?.month ||
          new Date().getMonth() + 1}`
      ), // Use timestamp for accurate date
      orders: thisMonthTotal?.orders.map((v) => v._id),
      shop: shop._id,
      total: thisMonthTotal?.totalIncome,
      totalIncome: Number(
        getTotalAfterComission(thisMonthTotal?.totalIncome)?.toFixed(1)
      ),
      totalCommission: Number(
        getComission(thisMonthTotal?.totalIncome)?.toFixed(1)
      ),
      status: 'pending',
      thisMonth: true,
    };

    return res.status(200).json({
      success: true,
      data: [
        thisMonthPayment,
        !lastMonthPaymentDate && { ...lastMonthPayment },
        ...allPayments,
      ].filter((v) => Boolean(v)),
      total: count,
      count: Math.ceil(count / parseInt(limit)),
      currentPage: page,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = {
  createPayment,
  getPaymentsByAdmin,
  updatePayment,
  deletePayment,
  getPaymentsByVender,
  getPaymentDetailsById,
  updatePaymentStatus,
  getPayoutsByAdmin,
  getIncomeByShop,
  getIncomeByvendor,
};
