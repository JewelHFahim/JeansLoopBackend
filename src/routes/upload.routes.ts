import { Router } from 'express';
import { uploadSingleImage, uploadMultipleImages } from '../controllers/upload.controller';
import { protect, admin } from '../middleware/auth';
import { uploadMiddleware, validateMagicBytes } from '../middleware/upload';
import { uploadLimiter } from '../middleware/rateLimiter';

const router = Router();

// Single image upload
router.post(
  '/',
  protect,
  admin,
  uploadLimiter,
  uploadMiddleware.single('image'),
  validateMagicBytes,
  uploadSingleImage
);

// Multiple image upload
router.post(
  '/multiple',
  protect,
  admin,
  uploadLimiter,
  uploadMiddleware.array('images', 10),
  validateMagicBytes,
  uploadMultipleImages
);

export default router;
