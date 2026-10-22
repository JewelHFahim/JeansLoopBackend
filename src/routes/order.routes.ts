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
import { protect, admin, checkPermission } from '../middleware/auth';
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

// Admin & Staff endpoints (Orders management)
router.get('/', protect, admin, checkPermission('orders'), validate(orderQuerySchema, 'query'), getOrders);
router.put('/:id/status', protect, admin, checkPermission('orders'), validate(updateOrderStatusSchema), updateStatus);
router.put('/:id/details', protect, admin, checkPermission('orders'), validate(updateOrderDetailsSchema), updateDetails);
router.put('/:id/pay', protect, admin, checkPermission('orders'), markOrderAsPaid);
router.put('/:id/deliver', protect, admin, checkPermission('orders'), markOrderAsDelivered);
router.delete('/:id', protect, admin, checkPermission('orders'), deleteOrder);

export default router;
