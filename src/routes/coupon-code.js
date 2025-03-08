const express = require("express");
const router = express.Router();
const couponCodeRoutes = require("../controllers/coupon-code");
// Import verifyToken function
const verifyToken = require("../config/jwt");
//user routes
router.get("/coupon-codes/:code", couponCodeRoutes.getCouponCodeByCode);
router.get("/admin/coupon-codes/:id", couponCodeRoutes.getCouponCodeById);
//admin routes
router.get(
	"/admin/coupon-codes",
	verifyToken,
	couponCodeRoutes.getCouponCodesByAdmin
);
router.post(
	"/admin/coupon-codes",
	verifyToken,
	couponCodeRoutes.createCouponCodeByAdmin
);
router.get(
	"/admin/coupon-codes/:id",
	verifyToken,
	couponCodeRoutes.getOneCouponCodeByAdmin
);
router.put(
	"/admin/coupon-codes/:id",
	verifyToken,
	couponCodeRoutes.updatedCouponCodeByAdmin
);
router.delete(
	"/admin/coupon-codes/:id",
	verifyToken,
	couponCodeRoutes.deleteCouponCodeByAdmin
);

module.exports = router;
