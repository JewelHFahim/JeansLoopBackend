import { Router } from 'express';
import {
  getSliders,
  getActiveSliders,
  getSliderById,
  createSlider,
  updateSlider,
  deleteSlider,
} from '../controllers/slider.controller';
import { protect, admin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createSliderSchema, updateSliderSchema } from '../schemas/slider.schema';

const router = Router();

// Public routes
router.get('/active', getActiveSliders);
router.get('/', getSliders);
router.get('/:id', getSliderById);

// Protected admin routes
router.post('/', protect, admin, validate(createSliderSchema), createSlider);
router.put('/:id', protect, admin, validate(updateSliderSchema), updateSlider);
router.delete('/:id', protect, admin, deleteSlider);

export default router;
