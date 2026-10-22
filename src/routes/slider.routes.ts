import { Router } from 'express';
import {
  getSliders,
  getActiveSliders,
  getSliderById,
  createSlider,
  updateSlider,
  deleteSlider,
} from '../controllers/slider.controller';
import { protect, admin, checkPermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createSliderSchema, updateSliderSchema } from '../schemas/slider.schema';

const router = Router();

// Public routes
router.get('/active', getActiveSliders);
router.get('/', getSliders);
router.get('/:id', getSliderById);

// Protected admin & staff routes (Hero Sliders management)
router.post('/', protect, admin, checkPermission('sliders'), validate(createSliderSchema), createSlider);
router.put('/:id', protect, admin, checkPermission('sliders'), validate(updateSliderSchema), updateSlider);
router.delete('/:id', protect, admin, checkPermission('sliders'), deleteSlider);

export default router;
