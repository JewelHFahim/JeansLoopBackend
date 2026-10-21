import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/escapeRegex';
import { createOrder, updateOrderStatus, updateOrderDetails } from '../services/order.service';

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

  // Customers can only view their own orders
  const isOwner = order.userId && (order.userId as any)._id?.toString() === req.user!.userId;
  const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUPER_ADMIN';

  if (!isOwner && !isAdmin) {
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
  const updatedOrder = await updateOrderStatus(id, status);
  sendSuccess(res, updatedOrder, 'Order status updated');
});

export const updateDetails = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const updatedOrder = await updateOrderDetails(id, req.body);
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

  sendSuccess(res, updated, 'Order marked as paid');
});

export const markOrderAsDelivered = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const updated = await updateOrderStatus(id, 'DELIVERED');
  sendSuccess(res, updated, 'Order marked as delivered');
});

export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const order = await Order.findByIdAndDelete(id);
  if (!order) {
    throw AppError.notFound('Order not found');
  }
  sendSuccess(res, null, 'Order deleted successfully');
});
