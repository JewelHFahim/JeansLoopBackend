import mongoose from 'mongoose';
import { env } from './env';

let isConnected = false;

export async function connectDB(retries = 100, delayMs = 3000): Promise<void> {
  if (isConnected) return;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      mongoose.set('strictQuery', true);

      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      isConnected = true;
      console.log(`✅  MongoDB connected: ${mongoose.connection.host}`);
      return;
    } catch (error: any) {
      console.error(`❌  MongoDB connection failed (attempt ${attempt}/${retries}):`, error.message || error);
      if (attempt < retries) {
        console.log(`⏳  Retrying database connection in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error('💥  All MongoDB connection attempts exhausted.');
        process.exit(1);
      }
    }
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️   MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('✅  MongoDB reconnected');
});

export async function closeDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.connection.close();
  isConnected = false;
  console.log('MongoDB connection closed');
}
