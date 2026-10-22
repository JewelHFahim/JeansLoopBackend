import { Router } from 'express';
import {
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} from '../controllers/coupon.controller';
import { protect, admin, checkPermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
} from '../schemas/coupon.schema';

const router = Router();

// Public validation endpoint for checkout
router.post('/validate', validate(validateCouponSchema), validateCoupon);

// Protected admin & staff endpoints (Coupons management)
router.get('/', protect, admin, checkPermission('coupons'), getCoupons);
router.get('/:id', protect, admin, checkPermission('coupons'), getCouponById);
router.post('/', protect, admin, checkPermission('coupons'), validate(createCouponSchema), createCoupon);
router.put('/:id', protect, admin, checkPermission('coupons'), validate(updateCouponSchema), updateCoupon);
router.delete('/:id', protect, admin, checkPermission('coupons'), deleteCoupon);

export default router;
