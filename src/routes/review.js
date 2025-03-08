
const express = require('express');
const router = express.Router();
const ReviewController = require('../controllers/review');
const verifyToken = require("../config/jwt");

// Routes for regular users (app reviews)
router.get('/app-reviews', verifyToken, ReviewController.getReviews); // Get all app reviews
router.post('/app-reviews', verifyToken, ReviewController.createReview); // Create a new app review

// Routes for admin users (app reviews)
router.get('/admin/app-reviews', verifyToken, ReviewController.getReviewsByAdmin); // Get all app reviews for admin
router.get('/admin/app-reviews/:rid', verifyToken, ReviewController.getOneReviewByAdmin); // Get a single app review by ID for admin
router.post('/admin/app-reviews', verifyToken, ReviewController.createReviewByAdmin); // Create a new app review by admin
router.put('/admin/app-reviews/:rid', verifyToken, ReviewController.updateReviewByAdmin); // Update an existing app review by admin
router.delete('/admin/app-reviews/:rid', verifyToken, ReviewController.deleteReviewByAdmin); // Delete an existing app review by admin

module.exports = router;
