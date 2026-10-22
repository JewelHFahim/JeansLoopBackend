import mongoose, { Schema, Document } from 'mongoose';

export interface IProductVariant {
  sku: string;
  size: string;
  color: string;
  price: number;
  stock: number;
}

export interface ISizeChartRow {
  waist: string;
  thigh: string;
  legOpening: string;
  long: string;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  color?: string;
  description: string;
  highlights: string[];
  price: number;
  comparePrice?: number;
  discountAmount?: number;
  discountPercentage?: number;
  discountedPrice?: number;
  category: string;
  images: string[];
  variants: IProductVariant[];
  sizeChart: ISizeChartRow[];
  isDraft: boolean;
  createdBy?: {
    userId?: mongoose.Types.ObjectId;
    name?: string;
    email?: string;
  };
  updatedBy?: {
    userId?: mongoose.Types.ObjectId;
    name?: string;
    email?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    color: { type: String, required: true, default: 'Default', trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

const SizeChartRowSchema = new Schema<ISizeChartRow>(
  {
    waist: { type: String, required: true },
    thigh: { type: String, required: true },
    legOpening: { type: String, required: true },
    long: { type: String, required: true },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    color: { type: String, default: 'Default', trim: true },
    description: { type: String, default: '' },
    highlights: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    comparePrice: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    discountedPrice: { type: Number, default: 0, min: 0 },
    category: { type: String, required: true, trim: true },
    images: { type: [String], required: true },
    variants: { type: [ProductVariantSchema], required: true },
    sizeChart: { type: [SizeChartRowSchema], default: [] },
    isDraft: { type: Boolean, default: false },
    createdBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
      email: { type: String },
    },
    updatedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
      email: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProductSchema.index({ category: 1, isDraft: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ discountedPrice: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ name: 'text', description: 'text' });

// Auto-calculate discountedPrice before saving
ProductSchema.pre<IProduct>('save', function (next) {
  if (this.discountPercentage && this.discountPercentage > 0) {
    this.discountedPrice = Math.max(0, this.price - (this.price * this.discountPercentage) / 100);
  } else if (this.discountAmount && this.discountAmount > 0) {
    this.discountedPrice = Math.max(0, this.price - this.discountAmount);
  } else {
    this.discountedPrice = 0;
  }
  next();
});

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
