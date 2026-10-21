import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    image: { type: String },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

CategorySchema.index({ order: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);
