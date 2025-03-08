const express = require("express");
const router = express.Router();
const cart = require("../controllers/cart");
const verifyToken = require("../config/jwt");

router.post("/cart", verifyToken, cart.getCart);
router.post("/cart/add", verifyToken, cart.addToCart);
router.post("/cart/remove", verifyToken, cart.removeFromCart);

module.exports = router;
