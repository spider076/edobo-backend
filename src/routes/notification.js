const express = require('express');
const router = express.Router();
const notificationRoutes = require('../controllers/notification');
// Import verifyToken function
const verifyToken = require('../config/jwt');

//admin routes
router.get('/admin/notifications',verifyToken, notificationRoutes.getNotifications);
router.post('/admin/notifications',verifyToken, notificationRoutes.createNotification);




module.exports = router;
