import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Product } from '../src/models/Product';
import { Category } from '../src/models/Category';
import { SiteSettings } from '../src/models/SiteSettings';
import { Slider } from '../src/models/Slider';

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌  FATAL: Seeding is strictly forbidden in production mode!');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeansloop';

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // 1. Categories
    const categoriesData = [
      { name: 'Jeans', slug: 'jeans', description: 'Premium stretch and raw denim jeans', order: 1 },
      { name: 'Twill', slug: 'twill', description: 'Tailored twill and chino pants', order: 2 },
      { name: 'Trouser', slug: 'trouser', description: 'Smart casual and formal trousers', order: 3 },
    ];

    for (const cat of categoriesData) {
      await Category.findOneAndUpdate({ slug: cat.slug }, cat, { upsert: true, new: true });
    }
    console.log('✅  Categories seeded');

    // 2. Site Settings
    await SiteSettings.findOneAndUpdate(
      {},
      {
        title: 'JeansLoop',
        tagline: 'Premium Denim Collection',
        email: 'support@jeansloop.com',
        phone: '+8801911209322',
        address: 'House 12, Road 4, Sector 3, Uttara, Dhaka-1230',
        businessHours: '10:00 AM - 10:00 PM (Daily)',
        announcement: 'Complimentary shipping inside Dhaka on orders above ৳2,000',
        socialLinks: {
          facebook: 'https://facebook.com/jeansloop',
          instagram: 'https://instagram.com/jeansloop',
          whatsapp: '01911209322',
        },
      },
      { upsert: true, new: true }
    );
    console.log('✅  Site settings seeded');

    // 3. Hero Sliders
    const slidersData = [
      {
        title: 'Crafted For Life',
        subtitle: 'Engineered denim built for unmatched comfort and lasting durability.',
        image: 'https://images.unsplash.com/photo-1542272604-780c96856592?q=80&w=1920&auto=format&fit=crop',
        primaryCta: { text: 'Shop Denim', href: '/shop?category=jeans' },
        secondaryCta: { text: 'View All', href: '/shop' },
        order: 1,
        isActive: true,
      },
      {
        title: 'Modern Tailoring',
        subtitle: 'Precision fit trousers and twill pants for contemporary gentlemen.',
        image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=1920&auto=format&fit=crop',
        primaryCta: { text: 'Explore Trousers', href: '/shop?category=trouser' },
        secondaryCta: null,
        order: 2,
        isActive: true,
      },
    ];

    for (const s of slidersData) {
      await Slider.findOneAndUpdate({ title: s.title }, s, { upsert: true, new: true });
    }
    console.log('✅  Sliders seeded');

    console.log('🎉  Initial seed completed successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
