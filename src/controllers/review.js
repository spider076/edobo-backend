const Review = require('../models/Review');
const { getUser, getAdmin } = require('../config/getUser');

const getReviews = async (req, res) => {
    try {
        const skip = 10;
        const ReviewTotal = await Review.find({}, null, {})

        const reviews = await Review.find({}, null, {
            skip: skip * (page - 1),
            limit: skip,
        }).populate({
            path: "user",
            select: ["firstName", "lastName", "cover", "orders"],
        }).sort({
            createdAt: -1,
        });

        res.status(200).json({
            success: true,
            data: reviews,
            count: Math.ceil(ReviewTotal.length / skip),
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createReview = async (req, res) => {
    try {
        const user = await getUser(req, res);
        const uid = user._id.toString();
        const { rating, review, designation } = req.body;

        // Create new review
        const newReview = await Review.create({
            user: uid,
            rating,
            review,
            designation,
        });

        res.status(201).json({ success: true, data: newReview });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

const getReviewsByAdmin = async (req, res) => {
    try {
        const skip = 10;
        const ReviewTotal = await Review.find({}, null, {}).sort({
            createdAt: -1,
        });

        const page = parseInt(req.query.page) || 1;

        const data = await Review.find({}, null, {
            skip: skip * (page - 1),
            limit: skip,
        }).sort({
            createdAt: -1,
        });

        res.status(200).json({
            success: true,
            data: data,
            count: Math.ceil(ReviewTotal.length / skip),
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getOneReviewByAdmin = async (req, res) => {
    try {
        const { rid } = req.params;
        const review = await Review.findById(rid);
        res.status(200).json({ success: true, data: review });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const createReviewByAdmin = async (req, res) => {
    try {
        const admin = await getAdmin(req, res);
        const uid = admin._id.toString();
        const { rating, review, designation } = req.body;

        // Create new review
        const newReview = await Review.create({
            user: uid,
            rating,
            review,
            designation,
        });

        res.status(201).json({ success: true, data: newReview });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

const updateReviewByAdmin = async (req, res) => {
    try {
        const admin = await getAdmin(req, res);
        const uid = admin._id.toString();
        const { rid } = req.params;
        const { rating, review, designation } = req.body;

        const newReview = await Review.findByIdAndUpdate(rid, {
            user: uid,
            rating,
            review,
            designation,
        });

        res.status(201).json({ success: true, data: newReview });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

const deleteReviewByAdmin = async (req, res) => {
    try {
        const { rid } = req.params;

        const deletedReview = await Review.findByIdAndDelete(rid);

        res.status(201).json({ success: true, data: deletedReview });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
};

module.exports = {
    getReviews,
    createReview,
    getReviewsByAdmin,
    getOneReviewByAdmin,
    createReviewByAdmin,
    updateReviewByAdmin,
    deleteReviewByAdmin
};
