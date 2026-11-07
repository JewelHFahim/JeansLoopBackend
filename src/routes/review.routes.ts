import { Router } from 'express';
import {
  getProductReviews,
  createProductReview,
  voteReviewHelpful,
  getAllReviewsAdmin,
  updateReviewStatus,
  deleteReviewAdmin,
} from '../controllers/review.controller';
import { validate } from '../middleware/validate';
import { protect, admin } from '../middleware/auth';
import { reviewLimiter } from '../middleware/rateLimiter';
import {
  createReviewSchema,
  reviewQuerySchema,
  adminReviewQuerySchema,
  updateReviewStatusSchema,
} from '../schemas/review.schema';

const router = Router();

// Public routes for product reviews
router.get('/product/:productIdOrSlug', validate(reviewQuerySchema, 'query'), getProductReviews);
router.post('/:reviewId/helpful', reviewLimiter, voteReviewHelpful);

// Logged-in Customer route: Post a review (Pending admin approval)
router.post('/', reviewLimiter, protect, validate(createReviewSchema), createProductReview);

// Admin routes: Review moderation & management
router.get('/admin', protect, admin, validate(adminReviewQuerySchema, 'query'), getAllReviewsAdmin);
router.patch('/admin/:reviewId/status', protect, admin, validate(updateReviewStatusSchema), updateReviewStatus);
router.delete('/admin/:reviewId', protect, admin, deleteReviewAdmin);

export default router;
