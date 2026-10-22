import { Router } from 'express';
import { getUsers, createUser, updateUserRole, deleteUser } from '../controllers/user.controller';
import { protect, strictAdmin } from '../middleware/auth';

const router = Router();

// Protected full administrator endpoints
router.get('/', protect, strictAdmin, getUsers);
router.post('/', protect, strictAdmin, createUser);
router.put('/:id/role', protect, strictAdmin, updateUserRole);
router.delete('/:id', protect, strictAdmin, deleteUser);

export default router;
