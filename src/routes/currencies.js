const express = require('express');
const router = express.Router();
const currencies = require('../controllers/currencies');

// Import verifyToken function
const verifyToken = require('../config/jwt');

router.get('/admin/currencies', verifyToken, currencies.getAdminCurrencies);
router.get('/admin/currencies/:cid', verifyToken, currencies.getCurrency);

router.post('/admin/currencies', verifyToken, currencies.createCurrency);

router.put('/admin/currencies/:cid', verifyToken, currencies.updateCurrency);

router.delete('/admin/currencies/:cid', verifyToken, currencies.deleteCurrency);
router.get('/currencies', currencies.getUserCurrencies);

module.exports = router;
