import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validates all required environment variables at startup.
 * The application will NOT start if any required variable is missing.
 */
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Redis (optional: if omitted, automatic high-speed in-memory cache is used)
  REDIS_URL: z.string().optional(),

  // JWT — no fallbacks; missing = immediate crash
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES: z.string().default('7d'),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001'),

  // File storage
  STORAGE_TYPE: z.enum(['LOCAL', 'CLOUDINARY']).default('LOCAL'),
  BACKEND_URL: z.string().url().default('http://localhost:5000'),

  // Cloudinary (optional unless STORAGE_TYPE=CLOUDINARY)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Stripe (optional in dev)
  STRIPE_SECRET_KEY: z.string().optional(),

  // Seed scripts
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('\n❌  FATAL: Invalid environment variables:\n');
  parsed.error.issues.forEach((issue) => {
    console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
  });
  console.error('\nUpdate your .env file and restart.\n');
  process.exit(1);
}

// Production safety guard against default insecure secrets
if (parsed.data.NODE_ENV === 'production') {
  if (parsed.data.JWT_SECRET.includes('development') || parsed.data.JWT_SECRET.includes('change_me')) {
    console.error('\n🚨 FATAL SECURITY RISK: Default JWT_SECRET detected in PRODUCTION mode. Change it immediately!\n');
    process.exit(1);
  }
  if (parsed.data.SEED_ADMIN_PASSWORD && (parsed.data.SEED_ADMIN_PASSWORD.includes('123456') || parsed.data.SEED_ADMIN_PASSWORD.includes('ChangeMe'))) {
    console.warn('\n⚠️  SECURITY WARNING: Weak SEED_ADMIN_PASSWORD detected in production.\n');
  }
}

export const env = parsed.data;
export type Env = typeof env;
