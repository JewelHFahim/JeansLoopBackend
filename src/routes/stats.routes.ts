import { Router } from 'express';
import { getStats } from '../controllers/stats.controller';
import { protect, admin } from '../middleware/auth';

const router = Router();

// Dashboard analytics (Admin only)
router.get('/', protect, admin, getStats);

export default router;
