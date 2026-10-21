import { Router } from 'express';
import { getUsers, deleteUser } from '../controllers/user.controller';
import { protect, admin } from '../middleware/auth';

const router = Router();

// Protected admin endpoints
router.get('/', protect, admin, getUsers);
router.delete('/:id', protect, admin, deleteUser);

export default router;
