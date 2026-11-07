import { z } from 'zod';

export const createReviewSchema = z.object({
  productId: z.string().trim().min(1, 'Product ID or slug is required'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  rating: z.coerce.number().int().min(1, 'Rating must be between 1 and 5').max(5),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120),
  comment: z.string().trim().min(5, 'Review comment must be at least 5 characters').max(1200),
  fit: z.enum(['true_to_size', 'runs_small', 'runs_large']).optional().default('true_to_size'),
});

export const reviewQuerySchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['newest', 'highest', 'lowest', 'helpful']).optional().default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const adminReviewQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).optional().default('all'),
  productId: z.string().trim().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  keyword: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const updateReviewStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: 'Status must be pending, approved, or rejected' }),
  }),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;
export type AdminReviewQueryInput = z.infer<typeof adminReviewQuerySchema>;
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>;
