import { Router } from 'express';
import {
  getProductReviews,
  createProductReview,
  voteReviewHelpful,
} from '../controllers/review.controller';
import { validate } from '../middleware/validate';
import { createReviewSchema, reviewQuerySchema } from '../schemas/review.schema';

const router = Router();

// Public routes for product reviews
router.get('/product/:productIdOrSlug', validate(reviewQuerySchema, 'query'), getProductReviews);
router.post('/', validate(createReviewSchema), createProductReview);
router.post('/:reviewId/helpful', voteReviewHelpful);

export default router;
