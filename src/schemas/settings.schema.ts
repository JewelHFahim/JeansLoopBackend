import { z } from 'zod';

export const socialLinksSchema = z.object({
  facebook: z.string().trim().optional().default(''),
  instagram: z.string().trim().optional().default(''),
  youtube: z.string().trim().optional().default(''),
  whatsapp: z.string().trim().optional().default(''),
  tiktok: z.string().trim().optional().default(''),
});

export const updateSettingsSchema = z.object({
  title: z.string().trim().min(1).optional(),
  tagline: z.string().trim().optional(),
  logo: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  locationMapUrl: z.string().trim().optional(),
  businessHours: z.string().trim().optional(),
  announcement: z.string().trim().optional(),
  socialLinks: socialLinksSchema.partial().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
