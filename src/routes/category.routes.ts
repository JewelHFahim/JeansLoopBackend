import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { protect, admin, checkPermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../schemas/category.schema';

const router = Router();

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategoryById);

// Protected admin & staff routes (Categories management)
router.post('/', protect, admin, checkPermission('categories'), validate(createCategorySchema), createCategory);
router.put('/:id', protect, admin, checkPermission('categories'), validate(updateCategorySchema), updateCategory);
router.delete('/:id', protect, admin, checkPermission('categories'), deleteCategory);

export default router;
