import { Coupon, ICoupon } from '../models/Coupon';
import { AppError } from '../utils/AppError';

export interface CouponValidationResult {
  coupon: ICoupon;
  discountAmount: number;
}

export async function validateAndApplyCoupon(
  code: string,
  subtotal: number
): Promise<CouponValidationResult> {
  const coupon = await Coupon.findOne({
    code: code.trim().toUpperCase(),
    isActive: true,
  });

  if (!coupon) {
    throw AppError.badRequest('Invalid or inactive coupon code', 'INVALID_COUPON');
  }

  if (new Date() > coupon.expiryDate) {
    throw AppError.badRequest('This coupon has expired', 'EXPIRED_COUPON');
  }

  if (subtotal < coupon.minAmount) {
    throw AppError.badRequest(
      `Coupon requires a minimum order amount of ৳${coupon.minAmount}`,
      'MIN_AMOUNT_NOT_MET'
    );
  }

  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    const safePercent = Math.min(100, Math.max(0, coupon.value));
    discountAmount = (subtotal * safePercent) / 100;
  } else {
    discountAmount = Math.max(0, coupon.value);
  }

  // Discount cannot exceed subtotal
  discountAmount = Math.min(discountAmount, subtotal);

  return { coupon, discountAmount };
}
