import { Router } from 'express';
import {
  getProducts,
  getProductBySlug,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller';
import { protect, admin, checkPermission } from '../middleware/auth';
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

// Protected admin & staff routes (Products management)
router.post('/', protect, admin, checkPermission('products'), validate(createProductSchema), createProduct);
router.put('/:id', protect, admin, checkPermission('products'), validate(updateProductSchema), updateProduct);
router.delete('/:id', protect, admin, checkPermission('products'), deleteProduct);

export default router;
