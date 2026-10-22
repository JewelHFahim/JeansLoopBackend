import mongoose, { Schema, Document } from 'mongoose';

export interface ISocialLinks {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  whatsapp?: string;
  tiktok?: string;
}

export interface IFeaturedCategorySection {
  enabled: boolean;
  category: string;
  title: string;
  tagline: string;
  badge: string;
  bannerImage: string;
  buttonText: string;
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
  featuredCategorySection: IFeaturedCategorySection;
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

const FeaturedCategorySectionSchema = new Schema<IFeaturedCategorySection>(
  {
    enabled: { type: Boolean, default: true },
    category: { type: String, default: 'Jeans' },
    title: { type: String, default: 'Denim Jeans' },
    tagline: { type: String, default: 'Authentic Raw Denim • Engineered for Durability' },
    badge: { type: String, default: 'Featured Collection' },
    bannerImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=1200',
    },
    buttonText: { type: String, default: 'Explore Collection' },
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
    featuredCategorySection: { type: FeaturedCategorySectionSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

export const SiteSettings = mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema);
