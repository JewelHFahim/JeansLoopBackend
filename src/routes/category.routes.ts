import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { protect, admin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../schemas/category.schema';

const router = Router();

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Protected admin routes
router.post('/', protect, admin, validate(createCategorySchema), createCategory);
router.put('/:id', protect, admin, validate(updateCategorySchema), updateCategory);
router.delete('/:id', protect, admin, deleteCategory);

export default router;
