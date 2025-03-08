const Notifications = require("../models/Notification");
const Products = require("../models/Product");
const Orders = require("../models/Order");
const Coupons = require("../models/CouponCode");
const User = require("../models/User");
const Shop = require("../models/Shop");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const Razorpay = require("razorpay");
const { getVendor, getAdmin } = require("../config/getUser");
function isExpired(expirationDate) {
  const currentDateTime = new Date();
  return currentDateTime >= new Date(expirationDate);
}
function generateOrderNumber() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let orderNumber = "";

  // Generate a random alphabet character
  orderNumber += alphabet.charAt(Math.floor(Math.random() * alphabet.length));

  // Generate 4 random digits
  for (let i = 0; i < 6; i++) {
    orderNumber += Math.floor(Math.random() * 10);
  }

  console.log("random order number : ", orderNumber);

  return orderNumber;
}
function readHTMLTemplate() {
  const htmlFilePath = path.join(
    process.cwd(),
    "src/email-templates",
    "order.html"
  );
  return fs.readFileSync(htmlFilePath, "utf8");
}

const createOrder = async (req, res) => {
  try {
    const {
      items,
      user,
      paymentMethod,
      paymentId,
      couponCode,
      totalItems,
      shipping,
      description,
    } = await req.body;

    if (!items || !items.length) {
      return res
        .status(400)
        .json({ success: false, message: "Please Provide Item(s)" });
    }

    const products = await Products.find({
      _id: { $in: items.map((item) => item.pid) },
    });

    const updatedItems = items.map((item) => {
      const product = products.find((p) => p._id.toString() === item.pid);
      const price = product ? product.priceSale : 0;
      const total = price * item.quantity;

      Products.findOneAndUpdate(
        { _id: item.pid, available: { $gte: 0 } },
        { $inc: { available: -item.quantity, sold: item.quantity } },
        { new: true, runValidators: true }
      ).exec();

      return {
        ...item,
        total,
        shop: product?.shop,
        imageUrl: product.images.length > 0 ? product.images[0].url : "",
      };
    });

    const grandTotal = updatedItems.reduce((acc, item) => acc + item.total, 0);
    let discount = 0;

    if (couponCode) {
      const couponData = await Coupons.findOne({ code: couponCode });

      const expired = isExpired(couponData.expire);
      if (expired) {
        return res
          .status(400)
          .json({ success: false, message: "CouponCode Is Expired" });
      }
      // Add the user's email to the usedBy array of the coupon code
      await Coupons.findOneAndUpdate(
        { code: couponCode },
        { $addToSet: { usedBy: user.email } }
      );

      if (couponData && couponData.type === "percent") {
        const percentLess = couponData.discount;
        discount = (percentLess / 100) * grandTotal;
      } else if (couponData) {
        discount = couponData.discount;
      }
    }

    let discountedTotal = grandTotal - discount;
    discountedTotal = discountedTotal || 0;

    const existingUser = await User.findOne({ email: user.email });
    const orderNo = await generateOrderNumber();
    const orderCreated = await Orders.create({
      paymentMethod,
      paymentId,
      discount,
      currency: "INR",
      description: description || "",
      total: discountedTotal + Number(shipping),
      subTotal: grandTotal,
      shipping,
      items: updatedItems.map(({ image, ...others }) => others),
      user: existingUser ? { ...user, _id: existingUser._id } : user,
      totalItems,
      orderNo,
      status: "pending",
    });

    await Notifications.create({
      opened: false,
      title: `${user.firstName} ${user.lastName} placed an order from ${user.city}.`,
      paymentMethod,
      orderId: orderCreated._id,
      city: user.city,
      cover: user?.cover?.url || "",
    });

    // let htmlContent = readHTMLTemplate();

    // htmlContent = htmlContent.replace(
    //   /{{recipientName}}/g,
    //   `${user.firstName} ${user.lastName}`
    // );

    // let itemsHtml = '';
    // updatedItems.forEach((item) => {
    //   itemsHtml += `
    //     <tr style='border-bottom: 1px solid #e4e4e4;'>
    //       <td style="border-radius: 8px; box-shadow: 0 0 5px rgba(0, 0, 0, 0.1); overflow: hidden; border-spacing: 0; border: 0">
    //         <img src="${item.imageUrl}" alt="${item.name}" style="width: 62px; height: 62px; object-fit: cover; border-radius: 8px;">
    //       </td>
    //       <td style=" padding: 10px; border-spacing: 0; border: 0">${item.name}</td>
    //       <td style=" padding: 10px; border-spacing: 0; border: 0">${item.sku}</td>
    //       <td style=" padding: 10px; border-spacing: 0; border: 0">${item.quantity}</td>
    //       <td style=" padding: 10px; border-spacing: 0; border: 0">${item.priceSale}</td>
    //     </tr>
    //   `;
    // });

    // htmlContent = htmlContent.replace(/{{items}}/g, itemsHtml);
    // htmlContent = htmlContent.replace(/{{grandTotal}}/g, orderCreated.subTotal);
    // htmlContent = htmlContent.replace(/{{Shipping}}/g, orderCreated.shipping);
    // htmlContent = htmlContent.replace(/{{subTotal}}/g, orderCreated.total);

    // let transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: process.env.RECEIVING_EMAIL,
    //     pass: process.env.EMAIL_PASSWORD,
    //   },
    // });

    // let mailOptions = {
    //   from: process.env.RECEIVING_EMAIL,
    //   to: user.email,
    //   subject: 'Your Order Confirmation',
    //   html: htmlContent,
    // };

    // await transporter.sendMail(mailOptions);

    console.log("razor initializing.....");

    const razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_API_KEY_ID,
      key_secret: process.env.RAZORPAY_API_SECRET,
    });

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: (discountedTotal + shipping) * 100, // Amount in paise
      currency: "INR",
      receipt: orderCreated.orderNo,
      payment_capture: 1, // 1 for automatic capture, 0 for manual
    });

    console.log("razorpay orderId : ", razorpayOrder);

    return res.status(201).json({
      success: true,
      message: "Order Placed",
      orderId: orderCreated._id,
      data: items.name,
      orderNo,
      razorpayOrderId: razorpayOrder.id,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getOrderById = async (req, res) => {
  try {
    const id = req.params.id;
    const orderGet = await Orders.findById(id); // Remove curly braces around _id: id

    console.log("order get from getOrderbyId ", orderGet);

    if (!orderGet) {
      return res
        .status(404)
        .json({ success: false, message: "Order Not Found" });
    }

    return res.status(200).json({
      success: true,
      data: orderGet,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getOrdersByAdmin = async (req, res) => {
  try {
    const {
      page: pageQuery,
      limit: limitQuery,
      search: searchQuery,
      shop,
    } = req.query;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;

    const skip = limit * (page - 1);
    let matchQuery = {};

    if (shop) {
      const currentShop = await Shop.findOne({ slug: shop }).select(["_id"]);

      matchQuery["items.shop"] = currentShop._id;
    }

    const totalOrders = await Orders.countDocuments({
      $or: [
        { "user.firstName": { $regex: searchQuery || "", $options: "i" } },
        { "user.lastName": { $regex: searchQuery || "", $options: "i" } },
      ],
      ...matchQuery,
    });

    const orders = await Orders.aggregate([
      { $match: { ...matchQuery } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      total: totalOrders,
      count: Math.ceil(totalOrders / parseInt(limit)),
      currentPage: page,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOneOrderByAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    await Notifications.findOneAndUpdate(
      { orderId: id },
      {
        opened: true,
      },
      {
        new: true,
        runValidators: true,
      }
    );
    const orderGet = await Orders.findById({ _id: id });
    if (!orderGet) {
      return res.status(404).json({
        success: false,
        message: "Order Not Found",
      });
    }

    return res.status(200).json({
      success: true,
      data: orderGet,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const updateOrderByAdmin = async (req, res) => {
  try {
    const id = req.params.id;
    const data = await req.body;
    const order = await Orders.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order Not Found",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Order Updated",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const deleteOrderByAdmin = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Find the order to be deleted
    const order = await Orders.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order Not Found",
      });
    }

    // Delete the order from the Orders collection
    await Orders.findByIdAndDelete(orderId);

    // Remove the order ID from the user's order array
    await User.findOneAndUpdate(
      { _id: order.user },
      { $pull: { orders: orderId } }
    );

    // Delete notifications related to the order
    await Notifications.deleteMany({ orderId });

    return res.status(200).json({
      success: true,
      message: "Order Deleted",
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
// Vendor apis
const getOrdersByVendor = async (req, res) => {
  try {
    const vendor = await getVendor(req, res);
    const shop = await Shop.findOne({
      vendor: vendor._id.toString(),
    });
    if (!shop) {
      res.status(404).json({ success: false, message: "Shop not found" });
    }
    const { limit = 10, page = 1, search = "" } = req.query;

    const skip = parseInt(limit) * (parseInt(page) - 1) || 0;
    const pipeline = [
      {
        $match: {
          "items.shop": shop._id, // Assuming 'items.shop' refers to the shop ID associated with the order
          $or: [
            { "user.firstName": { $regex: new RegExp(search, "i") } },
            { "user.lastName": { $regex: new RegExp(search, "i") } },
          ],
        },
      },
    ];
    const totalOrderCount = await Orders.aggregate([
      ...pipeline,
      {
        $count: "totalOrderCount", // Name the count field as "totalOrderCount"
      },
    ]);
    // Access the count from the first element of the result array
    const count =
      totalOrderCount.length > 0 ? totalOrderCount[0].totalOrderCount : 0;

    const orders = await Orders.aggregate([
      ...pipeline,
      {
        $sort: { createdAt: -1 }, // Sort by createdAt in descending order
      },
      {
        $skip: skip, // Skip documents based on pagination
      },
      {
        $limit: parseInt(limit), // Limit the number of documents retrieved
      },
    ]);
    return res.status(200).json({
      success: true,
      data: orders,
      total: count,
      count: Math.ceil(count / parseInt(limit)),
      currentPage: page,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getOrdersByAdmin,
  getOneOrderByAdmin,
  updateOrderByAdmin,
  deleteOrderByAdmin,
  getOrdersByVendor,
};
