import express, { Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';

import { corsMiddleware } from './config/cors';
import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/error';

// Routes
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import userRoutes from './routes/user.routes';
import couponRoutes from './routes/coupon.routes';
import categoryRoutes from './routes/category.routes';
import sliderRoutes from './routes/slider.routes';
import uploadRoutes from './routes/upload.routes';
import statsRoutes from './routes/stats.routes';
import settingsRoutes from './routes/settings.routes';
import reviewRoutes from './routes/review.routes';

export function createApp(): Express {
  const app = express();

  // 1. Core security headers
  app.use(helmet());

  // 2. CORS
  app.use(corsMiddleware);

  // 3. Request parsers (safe 1MB body limit instead of 20MB)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Request logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 5. Global rate limiter
  app.use('/api', generalLimiter);

  // 6. Static uploads folder with explicit Cross-Origin-Resource-Policy
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  app.use(
    '/uploads',
    helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
    express.static(uploadDir)
  );

  // 7. Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 8. API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/coupons', couponRoutes);
  app.use('/api/v1/categories', categoryRoutes);
  app.use('/api/v1/sliders', sliderRoutes);
  app.use('/api/v1/upload', uploadRoutes);
  app.use('/api/v1/stats', statsRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/reviews', reviewRoutes);

  // 9. 404 handler
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'API route not found', code: 'ROUTE_NOT_FOUND' });
  });

  // 10. Centralized error handling (Must be last)
  app.use(errorHandler);

  return app;
}
