import { z } from 'zod';

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(3, 'Coupon code must be at least 3 characters').toUpperCase(),
    type: z.enum(['percentage', 'fixed']),
    value: z.number().positive('Discount value must be greater than 0'),
    minAmount: z.number().min(0, 'Minimum order amount must be non-negative').default(0),
    expiryDate: z.coerce.date().refine((date) => date > new Date(), {
      message: 'Expiry date must be in the future',
    }),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.type === 'percentage' && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    }
  );

export const updateCouponSchema = z
  .object({
    code: z.string().trim().min(3, 'Coupon code must be at least 3 characters').toUpperCase().optional(),
    type: z.enum(['percentage', 'fixed']).optional(),
    value: z.number().positive('Discount value must be greater than 0').optional(),
    minAmount: z.number().min(0, 'Minimum order amount must be non-negative').optional(),
    expiryDate: z.coerce
      .date()
      .refine((date) => date > new Date(), {
        message: 'Expiry date must be in the future',
      })
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'percentage' && data.value !== undefined && data.value > 100) {
        return false;
      }
      return true;
    },
    {
      message: 'Percentage discount cannot exceed 100%',
      path: ['value'],
    }
  );

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1, 'Coupon code is required').toUpperCase(),
  amount: z.number().min(0, 'Order amount must be positive'),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
