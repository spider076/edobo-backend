const User = require('../models/User');
const Orders = require('../models/Order');
const bcrypt = require('bcrypt');
const { getUser } = require('../config/getUser');

const getOneUser = async (req, res) => {
  try {
    const user = await getUser(req, res);

    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const getUserByAdmin = async (req, res) => {
  try {
    const id = req.params.uid;

    const pageQuery = req.params.page;
    const limitQuery = req.params.limit;

    const limit = parseInt(limitQuery) || 10;
    const page = parseInt(pageQuery) || 1;

    // Calculate skip correctly
    const skip = limit * (page - 1);

    const currentUser = await User.findOne({ _id: id });

    const totalOrders = await Orders.countDocuments({ 'user._id': id });

    const orders = await Orders.find({ 'user._id': id }, null, {
      skip: skip * (page - 1),
      limit: skip,
    }).sort({ createdAt: -1 });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found',
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        user: currentUser,
        orders,
        count: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
const updateUser = async (req, res) => {
  const user = await getUser(req, res);

  const uid = user._id.toString();

  try {
    const data = await req.body;
    const profile = await User.findByIdAndUpdate(
      uid,
      { ...data },
      {
        new: true,
        runValidators: true,
      }
    ).select('-password');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User Not Found',
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const user = await getUser(req, res);
    const { limit = 10, page = 1 } = req.query;

    const skip = parseInt(limit) * (parseInt(page) - 1) || 0;
    const totalOrderCount = await Orders.countDocuments();

    const orders = await Orders.find({ 'user.email': user.email }, null, {
      skip: skip,
      limit: parseInt(limit),
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: orders,
      count: Math.ceil(totalOrderCount / parseInt(limit)),
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const user = await getUser(req, res);
    const uid = user._id.toString();
    const { password, newPassword, confirmPassword } = await req.body;

    // Find the user by ID
    const userWithPassword = await User.findById(uid).select('password');

    if (!userWithPassword) {
      return res
        .status(404)
        .json({ success: false, message: 'User Not Found' });
    }

    // Check if the old password matches the stored hashed password
    const passwordMatch = await bcrypt.compare(
      password,
      userWithPassword.password
    );

    if (passwordMatch) {
      // Check if the new password and confirm password match
      if (newPassword !== confirmPassword) {
        return res
          .status(400)
          .json({ success: false, message: 'New Password Mismatch' });
      }
      if (password === newPassword) {
        return NextResponse.json(
          {
            success: false,
            message: 'Please Enter A New Password ',
          },
          { status: 400 }
        );
      }
      // Hash the new password before updating
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update the password with the hashed version
      const updatedUser = await User.findByIdAndUpdate(
        uid,
        { password: hashedNewPassword },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: 'User Not Found' });
      }

      return res
        .status(201)
        .json({ success: true, message: 'Password Changed' });
    } else {
      return res
        .status(400)
        .json({ success: false, message: 'Old Password Incorrect' });
    }
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOneUser,
  updateUser,
  getInvoice,
  changePassword,
  getUserByAdmin,
};
