import { Request, Response } from 'express';
import { SiteSettings } from '../models/SiteSettings';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({});
  }
  sendSuccess(res, settings);
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = new SiteSettings();
  }

  // Update top-level fields safely
  const allowedKeys = [
    'title',
    'tagline',
    'logo',
    'email',
    'phone',
    'address',
    'locationMapUrl',
    'businessHours',
    'announcement',
  ] as const;

  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) {
      (settings as any)[key] = req.body[key];
    }
  }

  if (req.body.socialLinks) {
    settings.socialLinks = {
      ...settings.socialLinks,
      ...req.body.socialLinks,
    };
  }

  if (req.body.featuredCategorySection) {
    settings.featuredCategorySection = {
      ...(settings.featuredCategorySection || {}),
      ...req.body.featuredCategorySection,
    };
  }

  const updated = await settings.save();
  sendSuccess(res, updated, 'Site settings updated successfully');
});
