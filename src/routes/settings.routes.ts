import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { protect, admin, checkPermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateSettingsSchema } from '../schemas/settings.schema';

const router = Router();

// Public read settings
router.get('/', getSettings);

// Protected admin & staff update (Site Settings management)
router.put('/', protect, admin, checkPermission('settings'), validate(updateSettingsSchema), updateSettings);

export default router;
