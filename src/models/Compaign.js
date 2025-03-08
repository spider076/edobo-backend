const mongoose = require('mongoose');

const CompaignSchema = new mongoose.Schema(
  {
    cover: {
      _id: {
        type: String,
        required: [true, 'image-id-required-error'],
      },
      url: {
        type: String,
        required: [true, 'image-url-required-error'],
      },
      blurDataURL: {
        type: String,
        required: [true, 'image-blur-data-url-required-error'],
      },
    },
    name: {
      type: String,
      required: [true, 'Name is required.'],
      maxlength: [100, 'Name cannot exceed 100 characters.'],
    },
    metaTitle: {
      type: String,
      required: [true, 'Meta title is required.'],
      maxlength: [100, 'Meta title cannot exceed 100 characters.'],
    },
    description: {
      type: String,
      required: [true, 'Description is required.'],
      maxlength: [500, 'Description cannot exceed 500 characters.'],
    },
    metaDescription: {
      type: String,
      required: [true, 'Meta description is required.'],
      maxlength: [200, 'Meta description cannot exceed 200 characters.'],
    },
    slug: {
      type: String,
      unique: true,
      required: true,
    },

    products: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    discountType: {
      type: String,
      enum: ['fixed', 'percent'],
      required: true,
    },
    discount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      default: 'enable',
      enum: ['enable', 'disable'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Compaign =
  mongoose.models.Compaign || mongoose.model('Compaign', CompaignSchema);
module.exports = Compaign;
