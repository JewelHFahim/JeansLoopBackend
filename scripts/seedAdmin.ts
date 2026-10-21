import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { User } from '../src/models/User';

async function seedAdmin() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jeansloop';
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@jeansloop.com';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password || password.length < 8) {
    console.error('❌  SEED_ADMIN_PASSWORD environment variable must be set and at least 8 characters long.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    let admin = await User.findOne({ email });
    if (admin) {
      console.log(`Admin account already exists for "${email}". Updating password and role.`);
      admin.password = password;
      admin.role = 'SUPER_ADMIN';
      await admin.save();
    } else {
      admin = await User.create({
        name: 'Super Admin',
        email,
        password,
        role: 'SUPER_ADMIN',
        phone: '01911209322',
      });
      console.log(`✅  Super Admin created successfully for "${email}".`);
    }

    console.log('Admin setup complete.');
  } catch (error) {
    console.error('Failed to seed admin:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedAdmin();
