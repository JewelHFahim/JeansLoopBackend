import { Router } from 'express';
import { getActivityLogs } from '../controllers/activity.controller';
import { protect, admin } from '../middleware/auth';

const router = Router();

// Protected admin endpoint
router.get('/', protect, admin, getActivityLogs);

export default router;
