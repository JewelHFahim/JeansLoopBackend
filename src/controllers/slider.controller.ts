import { Request, Response } from 'express';
import { Slider } from '../models/Slider';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { cache } from '../services/cache.service';

const SLIDERS_ACTIVE_KEY = 'sliders:active';

export const getSliders = asyncHandler(async (_req: Request, res: Response) => {
  const sliders = await Slider.find().sort({ order: 1 });
  sendSuccess(res, sliders);
});

export const getActiveSliders = asyncHandler(async (_req: Request, res: Response) => {
  const cached = await cache.get(SLIDERS_ACTIVE_KEY);
  if (cached) {
    return sendSuccess(res, cached);
  }

  const sliders = await Slider.find({ isActive: true }).sort({ order: 1 });
  await cache.set(SLIDERS_ACTIVE_KEY, sliders, 300); // 5 min
  sendSuccess(res, sliders);
});

export const getSliderById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const slider = await Slider.findById(id);
  if (!slider) {
    throw AppError.notFound('Slider not found');
  }
  sendSuccess(res, slider);
});

export const createSlider = asyncHandler(async (req: Request, res: Response) => {
  const slider = await Slider.create(req.body);
  await cache.del(SLIDERS_ACTIVE_KEY);
  sendSuccess(res, slider, 'Slider created successfully', 201);
});

export const updateSlider = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const slider = await Slider.findById(id);
  if (!slider) {
    throw AppError.notFound('Slider not found');
  }

  Object.assign(slider, req.body);
  const updated = await slider.save();
  await cache.del(SLIDERS_ACTIVE_KEY);

  sendSuccess(res, updated, 'Slider updated successfully');
});

export const deleteSlider = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const slider = await Slider.findByIdAndDelete(id);
  if (!slider) {
    throw AppError.notFound('Slider not found');
  }
  await cache.del(SLIDERS_ACTIVE_KEY);
  sendSuccess(res, null, 'Slider deleted successfully');
});
