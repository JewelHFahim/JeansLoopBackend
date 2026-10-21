import { z } from 'zod';

export const productVariantSchema = z.object({
  sku: z.string().trim().min(1, 'Variant SKU is required'),
  size: z.string().trim().min(1, 'Size is required'),
  color: z.string().trim().default('Default'),
  price: z.number().min(0, 'Price must be non-negative'),
  stock: z.number().int().min(0, 'Stock must be non-negative integer'),
});

export const sizeChartRowSchema = z.object({
  waist: z.string().trim(),
  thigh: z.string().trim(),
  legOpening: z.string().trim(),
  long: z.string().trim(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required'),
  slug: z.string().trim().min(2, 'Slug is required'),
  color: z.string().trim().optional().default('Default'),
  description: z.string().trim().default(''),
  highlights: z.array(z.string().trim()).default([]),
  price: z.number().min(0, 'Price must be non-negative'),
  comparePrice: z.number().min(0).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  discountPercentage: z.number().min(0).max(100).optional().default(0),
  category: z.string().trim().min(1, 'Category is required'),
  images: z.array(z.string().url()).min(1, 'At least one image is required'),
  variants: z.array(productVariantSchema).min(1, 'At least one variant is required'),
  sizeChart: z.array(sizeChartRowSchema).optional().default([]),
  isDraft: z.boolean().optional().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  keyword: z.string().trim().optional(),
  category: z.string().trim().optional(),
  hasDiscount: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price-low', 'price-high', 'name']).optional().default('newest'),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  size: z.string().trim().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
