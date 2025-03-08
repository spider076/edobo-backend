const express = require('express');
const router = express.Router();
const dashboard = require('../controllers/dashboard');

// Import verifyToken function
const verifyToken = require('../config/jwt');

router.get(
  '/admin/dashboard-analytics',
  verifyToken,
  dashboard.getDashboardAnalytics
);
router.get(
  '/admin/low-stock-products',
  verifyToken,
  dashboard.getAdminLowStockProducts
);
router.get(
  '/vendor/low-stock-products',
  verifyToken,
  dashboard.getVendorLowStockProducts
);
router.get(
  '/vendor/dashboard-analytics',
  verifyToken,
  dashboard.getVendorAnalytics
);

router.get('/admin/notifications', verifyToken, dashboard.getNofications);

module.exports = router;
