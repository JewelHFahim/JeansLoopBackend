import { Router } from 'express';
import {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} from '../controllers/coupon.controller';
import { protect, admin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from '../schemas/coupon.schema';

const router = Router();

// Public validation endpoint for checkout
router.post('/validate', validate(validateCouponSchema), validateCoupon);

// Protected admin endpoints (Critical fix from code review)
router.get('/', protect, admin, getCoupons);
router.get('/:id', protect, admin, getCouponById);
router.post('/', protect, admin, validate(createCouponSchema), createCoupon);
router.put('/:id', protect, admin, validate(updateCouponSchema), updateCoupon);
router.delete('/:id', protect, admin, deleteCoupon);

export default router;
