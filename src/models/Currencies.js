const mongoose = require('mongoose');

const CurrencySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
    },
    code: {
      type: String,
      unique: true,
      required: [true, 'Code is required.'],
    },
    country: {
      type: String,
      minlength: 4,
      required: [true, 'Country is required.'],
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    rate: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);
const Currency =
  mongoose.models.Currency || mongoose.model('Currency', CurrencySchema);
module.exports = Currency;
