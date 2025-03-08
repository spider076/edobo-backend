const express = require('express');
const router = express.Router();
const newsletter = require('../controllers/newsletter');

// Import verifyToken function
const verifyToken = require('../config/jwt');

router.get('/admin/newsletter', verifyToken, newsletter.getNewsletters);

// User routes

router.post('/newsletter', newsletter.createNewsletter); // Add token verification middleware

module.exports = router;
