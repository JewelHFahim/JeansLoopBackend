import { z } from 'zod';

export const orderItemInputSchema = z.object({
  productId: z.string().trim().min(1, 'Product ID is required'),
  variantSku: z.string().trim().min(1, 'Variant SKU is required'),
  name: z.string().trim().min(1, 'Item name is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  size: z.string().trim().default(''),
  color: z.string().trim().default(''),
  image: z.string().optional(),
});

export const shippingAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Recipient full name is required'),
  phone: z.string().trim().min(11, 'Phone must be at least 11 digits'),
  altPhone: z.string().trim().optional(),
  street: z.string().trim().min(3, 'Detailed delivery address is required'),
  city: z.string().trim().min(2, 'City/District is required'),
  country: z.string().trim().default('Bangladesh'),
  note: z.string().trim().optional(),
});

export const createOrderSchema = z.object({
  orderItems: z.array(orderItemInputSchema).min(1, 'At least one item is required in the order'),
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(['cod', 'bkash', 'card']).default('cod'),
  couponCode: z.string().trim().optional(),
  bkashNumber: z.string().trim().optional(),
  bkashTxnId: z.string().trim().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'COURIERED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'EXCHANGE']),
});

export const updateOrderDetailsSchema = z.object({
  shippingAddress: shippingAddressSchema.partial().optional(),
  exchangeAmount: z.number().min(0).optional(),
  bkashNumber: z.string().trim().optional(),
  bkashTxnId: z.string().trim().optional(),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  keyword: z.string().trim().optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'COURIERED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'EXCHANGE']).optional(),
});

export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type UpdateOrderDetailsInput = z.infer<typeof updateOrderDetailsSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
