import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { protect, admin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from '../schemas/product.schema';

const router = Router();

// Public store routes
router.get('/', validate(productQuerySchema, 'query'), getProducts);
router.get('/details/:id', getProductById);
router.get('/:slug', getProductBySlug);

// Protected admin routes
router.post('/', protect, admin, validate(createProductSchema), createProduct);
router.put('/:id', protect, admin, validate(updateProductSchema), updateProduct);
router.delete('/:id', protect, admin, deleteProduct);

export default router;
