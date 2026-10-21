import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { protect, admin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateSettingsSchema } from '../schemas/settings.schema';

const router = Router();

// Public read settings
router.get('/', getSettings);

// Protected admin update
router.put('/', protect, admin, validate(updateSettingsSchema), updateSettings);

export default router;
