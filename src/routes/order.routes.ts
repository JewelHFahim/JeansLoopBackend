import { Router } from 'express';
import {
  addOrderItems,
  getOrderById,
  getMyOrders,
  getOrders,
  updateStatus,
  updateDetails,
  markOrderAsPaid,
  markOrderAsDelivered,
  deleteOrder,
} from '../controllers/order.controller';
import { protect, admin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  updateOrderDetailsSchema,
  orderQuerySchema,
} from '../schemas/order.schema';

const router = Router();

// Customer endpoints (all require authentication)
router.post('/', protect, validate(createOrderSchema), addOrderItems);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);

// Admin endpoints
router.get('/', protect, admin, validate(orderQuerySchema, 'query'), getOrders);
router.put('/:id/status', protect, admin, validate(updateOrderStatusSchema), updateStatus);
router.put('/:id/details', protect, admin, validate(updateOrderDetailsSchema), updateDetails);
router.put('/:id/pay', protect, admin, markOrderAsPaid);
router.put('/:id/deliver', protect, admin, markOrderAsDelivered);
router.delete('/:id', protect, admin, deleteOrder);

export default router;
