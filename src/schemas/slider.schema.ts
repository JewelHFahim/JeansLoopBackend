import { z } from 'zod';

export const sliderCtaSchema = z.object({
  text: z.string().trim().min(1, 'CTA text is required'),
  href: z.string().trim().min(1, 'CTA link is required'),
});

export const createSliderSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  subtitle: z.string().trim().optional().default(''),
  image: z.string().url('A valid image URL is required'),
  primaryCta: sliderCtaSchema.optional().nullable(),
  secondaryCta: sliderCtaSchema.optional().nullable(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const updateSliderSchema = createSliderSchema.partial();

export type CreateSliderInput = z.infer<typeof createSliderSchema>;
export type UpdateSliderInput = z.infer<typeof updateSliderSchema>;
