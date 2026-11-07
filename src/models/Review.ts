import mongoose, { Schema, Document } from 'mongoose';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  rating: number;
  title: string;
  comment: string;
  fit?: 'true_to_size' | 'runs_small' | 'runs_large';
  verifiedPurchase: boolean;
  helpfulCount: number;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 120,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    fit: {
      type: String,
      enum: ['true_to_size', 'runs_small', 'runs_large'],
      default: 'true_to_size',
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

ReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ productId: 1, rating: -1 });
ReviewSchema.index({ status: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
