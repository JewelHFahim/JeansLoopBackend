import mongoose, { Schema, Document } from 'mongoose';

export interface ISliderCta {
  text: string;
  href: string;
}

export interface ISlider extends Document {
  title: string;
  subtitle?: string;
  image: string;
  primaryCta?: ISliderCta;
  secondaryCta?: ISliderCta;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SliderCtaSchema = new Schema<ISliderCta>(
  {
    text: { type: String, required: true },
    href: { type: String, required: true },
  },
  { _id: false }
);

const SliderSchema = new Schema<ISlider>(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, default: '' },
    image: { type: String, required: true },
    primaryCta: { type: SliderCtaSchema, default: null },
    secondaryCta: { type: SliderCtaSchema, default: null },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

SliderSchema.index({ isActive: 1, order: 1 });

export const Slider = mongoose.model<ISlider>('Slider', SliderSchema);
