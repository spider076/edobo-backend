"use strict";
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const fs = require("fs");
// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

// Routes

// var cron = require('node-cron');

// cron.schedule('* * * * *', () => {
//   console.log('running a task every minute');
// });

const homeRoutes = require("./routes/home");
const authRoutes = require("./routes/auth");
const brandRoutes = require("./routes/brand");
const categoryRoutes = require("./routes/category");
const subcategoryRoutes = require("./routes/subcategory");
const newsletterRoutes = require("./routes/newsletter");
const productRoutes = require("./routes/product");
const dashboardRoutes = require("./routes/dashboard");
const searchRoutes = require("./routes/search");
const userRoutes = require("./routes/user");
const cartRoutes = require("./routes/cart");
const couponCodeRoutes = require("./routes/coupon-code");
const productReviewRoutes = require("./routes/product-review");
const reviewRoutes = require("./routes/review");
const wishlistRoutes = require("./routes/wishlist");
const OrderRoutes = require("./routes/order");
const paymentRoutes = require("./routes/payment-intents");
const delete_fileRoutes = require("./routes/file-delete");
const shopRoutes = require("./routes/shop");
const payment = require("./routes/payment");
const currency = require("./routes/currencies");
const compaign = require("./routes/compaign");
const processPdf = require("./controllers/processPdf");
const multer = require("multer");
const path = require("path");

app.use("/api", homeRoutes);
app.use("/api", authRoutes);
app.use("/api", brandRoutes);
app.use("/api", categoryRoutes);
app.use("/api", subcategoryRoutes);
app.use("/api", newsletterRoutes);
app.use("/api", productRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", searchRoutes);
app.use("/api", userRoutes);
app.use("/api", cartRoutes);
app.use("/api", couponCodeRoutes);
app.use("/api", productReviewRoutes);
app.use("/api", reviewRoutes);
app.use("/api", wishlistRoutes);
app.use("/api", OrderRoutes);
app.use("/api", paymentRoutes);
app.use("/api", delete_fileRoutes);
app.use("/api", shopRoutes);
app.use("/api", payment);
app.use("/api", currency);
app.use("/api", compaign);

// google vision api

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve("./uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir); // Ensure upload directory exists
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Save file with its original name
  }
});

const upload = multer({ storage });

// GET API
app.get("/", (req, res) => {
  res.send("This is a GET API");
});

app.post("/api/process-pdf", upload.single("file"), processPdf);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
