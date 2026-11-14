import { Request, Response } from 'express';
import { SiteSettings } from '../models/SiteSettings';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { cache } from '../services/cache.service';

const SETTINGS_CACHE_KEY = 'settings:site';

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const cached = await cache.get(SETTINGS_CACHE_KEY);
  if (cached) {
    return sendSuccess(res, cached);
  }

  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({});
  }
  await cache.set(SETTINGS_CACHE_KEY, settings, 300); // 5 min TTL
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
    'announcementEnabled',
    'announcementLink',
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
  await cache.del(SETTINGS_CACHE_KEY);
  sendSuccess(res, updated, 'Site settings updated successfully');
});
