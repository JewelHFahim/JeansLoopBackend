import mongoose, { Schema, Document } from 'mongoose';

export interface ISocialLinks {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
  tiktok?: string;
}

export interface ISiteSettings extends Document {
  title: string;
  tagline: string;
  logo: string;
  email: string;
  phone: string;
  address: string;
  locationMapUrl: string;
  businessHours: string;
  announcement: string;
  socialLinks: ISocialLinks;
  createdAt: Date;
  updatedAt: Date;
}

const SocialLinksSchema = new Schema<ISocialLinks>(
  {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    tiktok: { type: String, default: '' },
  },
  { _id: false }
);

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    title: { type: String, default: 'JeansLoop' },
    tagline: { type: String, default: 'Premium Denim Collection' },
    logo: { type: String, default: '' },
    email: { type: String, default: 'info@jeansloop.com' },
    phone: { type: String, default: '+8801911209322' },
    address: { type: String, default: 'Dhaka, Bangladesh' },
    locationMapUrl: { type: String, default: '' },
    businessHours: { type: String, default: '10:00 AM - 08:00 PM' },
    announcement: { type: String, default: 'Welcome to JeansLoop — Premium Quality Guaranteed' },
    socialLinks: { type: SocialLinksSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

export const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema);
