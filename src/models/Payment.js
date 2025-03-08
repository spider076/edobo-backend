const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop', // Reference to your Shop model
    required: true,
  },
  orders: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order', // Reference to your Order model
    },
  ],
  total: {
    type: Number,
    required: true,
  },
  totalCommission: {
    type: Number,
    required: true,
  },
  totalIncome: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'hold'],
    default: 'pending',
  },
  paidAt: {
    type: Date,
  },
  tip: {
    type: Number,
  },
  type: {
    type: String,
    enum: ['monthly', 'other'],
    default: 'monthly',
  },
  date: {
    type: Date,
    default: Date.now,
  },
  message: String,
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
