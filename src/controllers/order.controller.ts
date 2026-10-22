import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/escapeRegex';
import { createOrder, updateOrderStatus, updateOrderDetails } from '../services/order.service';
import { recordActivity } from '../services/activity.service';

export const addOrderItems = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const order = await createOrder(userId, req.body);
  sendSuccess(res, { order }, 'Order placed successfully', 201);
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const order = await Order.findById(id).populate('userId', 'name email phone');

  if (!order) {
    throw AppError.notFound('Order not found');
  }

  // Customers can only view their own orders; Admins & Staff with 'orders' permission can view any order
  const isOwner = order.userId && (order.userId as any)._id?.toString() === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';
  const isStaffWithOrderPerm =
    (req.user!.role === 'MANAGER' || req.user!.role === 'STAFF') &&
    (req.user!.permissions?.includes('orders') || req.user!.permissions?.includes('*'));

  if (!isOwner && !isAdmin && !isStaffWithOrderPerm) {
    throw AppError.forbidden('You are not authorized to view this order');
  }

  sendSuccess(res, order);
});

export const getMyOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await Order.find({ userId: req.user!.userId }).sort({ createdAt: -1 });
  sendSuccess(res, orders);
});

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.paymentMethod) {
    filter.paymentMethod = req.query.paymentMethod;
  }

  if (req.query.isPaid !== undefined && req.query.isPaid !== '') {
    filter.isPaid = String(req.query.isPaid) === 'true';
  }

  if (req.query.zone === 'dhaka') {
    filter['shippingAddress.city'] = { $regex: '^dhaka$', $options: 'i' };
  } else if (req.query.zone === 'outside_dhaka') {
    filter['shippingAddress.city'] = { $not: { $regex: '^dhaka$', $options: 'i' } };
  } else if (req.query.city) {
    filter['shippingAddress.city'] = { $regex: `^${escapeRegex(String(req.query.city))}$`, $options: 'i' };
  }

  if (req.query.dateRange && req.query.dateRange !== 'all') {
    const now = new Date();
    if (req.query.dateRange === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filter.createdAt = { $gte: startOfDay };
    } else if (req.query.dateRange === 'yesterday') {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filter.createdAt = { $gte: startOfYesterday, $lt: endOfYesterday };
    } else if (req.query.dateRange === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: sevenDaysAgo };
    } else if (req.query.dateRange === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filter.createdAt = { $gte: thirtyDaysAgo };
    }
  }

  if (req.query.keyword) {
    const escaped = escapeRegex(String(req.query.keyword));
    filter.$or = [
      { 'shippingAddress.fullName': { $regex: escaped, $options: 'i' } },
      { 'shippingAddress.phone': { $regex: escaped, $options: 'i' } },
      { 'shippingAddress.city': { $regex: escaped, $options: 'i' } },
      { bkashTxnId: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  sendPaginated(res, orders, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body;
  const operator = {
    userId: req.user!.userId,
    email: req.user!.email,
  };
  const updatedOrder = await updateOrderStatus(id, status, operator);

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'ORDER_STATUS_CHANGED',
    entityType: 'ORDER',
    entityId: id,
    entityTitle: `Order #${id.slice(-6).toUpperCase()}`,
    description: `Changed order status to ${status}`,
    details: { status },
  });

  sendSuccess(res, updatedOrder, 'Order status updated');
});

export const updateDetails = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const updatedOrder = await updateOrderDetails(id, req.body);

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'ORDER_DETAILS_UPDATED',
    entityType: 'ORDER',
    entityId: id,
    entityTitle: `Order #${id.slice(-6).toUpperCase()}`,
    description: `Updated delivery address / order details`,
  });

  sendSuccess(res, updatedOrder, 'Order details updated');
});

export const markOrderAsPaid = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const order = await Order.findById(id);
  if (!order) {
    throw AppError.notFound('Order not found');
  }

  order.isPaid = true;
  order.paidAt = new Date();
  const updated = await order.save();

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'ORDER_MARKED_PAID',
    entityType: 'ORDER',
    entityId: id,
    entityTitle: `Order #${id.slice(-6).toUpperCase()}`,
    description: `Marked order as PAID (Amount: ৳${order.totalAmount})`,
  });

  sendSuccess(res, updated, 'Order marked as paid');
});

export const markOrderAsDelivered = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const operator = {
    userId: req.user!.userId,
    email: req.user!.email,
  };
  const updated = await updateOrderStatus(id, 'DELIVERED', operator);

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'ORDER_MARKED_DELIVERED',
    entityType: 'ORDER',
    entityId: id,
    entityTitle: `Order #${id.slice(-6).toUpperCase()}`,
    description: `Marked order as DELIVERED`,
  });

  sendSuccess(res, updated, 'Order marked as delivered');
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const order = await Order.findByIdAndDelete(id);
  if (!order) {
    throw AppError.notFound('Order not found');
  }

  recordActivity({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    userRole: req.user!.role,
    action: 'ORDER_DELETED',
    entityType: 'ORDER',
    entityId: id,
    entityTitle: `Order #${id.slice(-6).toUpperCase()}`,
    description: `Deleted order permanently`,
  });

  sendSuccess(res, null, 'Order deleted successfully');
});
