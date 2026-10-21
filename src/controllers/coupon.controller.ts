import { Request, Response } from 'express';
import { Coupon } from '../models/Coupon';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { validateAndApplyCoupon } from '../services/coupon.service';

export const getCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  sendSuccess(res, coupons);
});

export const getCouponById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }
  sendSuccess(res, coupon);
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const existing = await Coupon.findOne({ code: req.body.code });
  if (existing) {
    throw AppError.conflict('A coupon with this code already exists');
  }

  const coupon = await Coupon.create(req.body);
  sendSuccess(res, coupon, 'Coupon created successfully', 201);
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const coupon = await Coupon.findById(id);
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }

  if (req.body.code && req.body.code !== coupon.code) {
    const existing = await Coupon.findOne({ code: req.body.code });
    if (existing) {
      throw AppError.conflict('A coupon with this code already exists');
    }
  }

  Object.assign(coupon, req.body);
  const updated = await coupon.save();

  sendSuccess(res, updated, 'Coupon updated successfully');
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) {
    throw AppError.notFound('Coupon not found');
  }
  sendSuccess(res, null, 'Coupon deleted successfully');
});

export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code, amount } = req.body;
  const result = await validateAndApplyCoupon(code, Number(amount));
  sendSuccess(res, {
    id: result.coupon._id,
    code: result.coupon.code,
    type: result.coupon.type,
    value: result.coupon.value,
    discountAmount: result.discountAmount,
  });
});
