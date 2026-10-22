import { Router } from 'express';
import { getStats } from '../controllers/stats.controller';
import { protect, admin, checkPermission } from '../middleware/auth';

const router = Router();

// Dashboard analytics (Admin & Staff with dashboard access)
router.get('/', protect, admin, checkPermission('dashboard'), getStats);

export default router;
