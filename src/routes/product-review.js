const express = require("express");
const router = express.Router();
const reviewRoutes = require("../controllers/product-review");
// Import verifyToken function
const verifyToken = require("../config/jwt");
//user routes
router.get("/reviews/:pid", reviewRoutes.getProductReviewsbyPid);
router.post("/reviews", verifyToken, reviewRoutes.createProductReview);

//admin routes
router.get("/admin/reviews", verifyToken, reviewRoutes.getProductReviewsByAdmin);
router.post("/admin/review", verifyToken, reviewRoutes.createProductReviewByAdmin);

module.exports = router;
