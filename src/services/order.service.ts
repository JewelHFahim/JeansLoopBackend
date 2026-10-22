import mongoose from 'mongoose';
import { Order, IOrder, IOrderItem } from '../models/Order';
import { Product, IProduct } from '../models/Product';
import { CreateOrderInput, UpdateOrderDetailsInput } from '../schemas/order.schema';
import { resolveLineItemPrice, calculateShippingFee } from './pricing.service';
import { validateAndApplyCoupon } from './coupon.service';
import { AppError } from '../utils/AppError';
import { invalidateStatsCache } from './stats.service';

/**
 * Creates a new order. Eliminates N+1 queries by batch-fetching products.
 * Atomically updates stock levels using bulkWrite.
 */
export async function createOrder(userId: string, input: CreateOrderInput): Promise<IOrder> {
  // 1. Batch fetch all products in a single database query
  const productIds = [...new Set(input.orderItems.map((item) => item.productId))];

  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map<string, IProduct>();
  products.forEach((p) => productMap.set(p._id.toString(), p));

  // 2. Validate all products and stock availability
  let calculatedItemsPrice = 0;
  const verifiedItems: IOrderItem[] = [];
  const stockBulkOperations: any[] = [];

  for (const item of input.orderItems) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw AppError.notFound(`Product with ID "${item.productId}" not found`);
    }

    // Find variant for stock check
    const variant = product.variants.find((v) => v.sku === item.variantSku);
    if (variant && variant.stock < item.quantity) {
      throw AppError.badRequest(
        `Insufficient stock for "${product.name}" (${variant.size}). Available: ${variant.stock}, Requested: ${item.quantity}`,
        'INSUFFICIENT_STOCK'
      );
    }

    const unitPrice = resolveLineItemPrice(product, item);
    calculatedItemsPrice += unitPrice * item.quantity;

    verifiedItems.push({
      productId: product._id as mongoose.Types.ObjectId,
      variantSku: item.variantSku,
      name: product.name,
      price: unitPrice,
      quantity: item.quantity,
      size: item.size || variant?.size,
      color: item.color || variant?.color,
      image: item.image || product.images[0],
    });

    // Prepare atomic stock decrement
    if (variant) {
      stockBulkOperations.push({
        updateOne: {
          filter: { _id: product._id, 'variants.sku': variant.sku },
          update: { $inc: { 'variants.$.stock': -item.quantity } },
        },
      });
    }
  }

  // 3. Coupon and discount verification
  let calculatedDiscount = 0;
  let appliedCouponCode: string | undefined;

  if (input.couponCode) {
    const couponResult = await validateAndApplyCoupon(input.couponCode, calculatedItemsPrice);
    calculatedDiscount = couponResult.discountAmount;
    appliedCouponCode = couponResult.coupon.code;
  }

  // 4. Server-enforced shipping price
  const shippingPrice = calculateShippingFee(input.shippingAddress.city);
  const taxPrice = 0;
  const totalAmount = Math.max(0, calculatedItemsPrice + shippingPrice + taxPrice - calculatedDiscount);

  // 5. Decrement inventory atomically via bulkWrite
  if (stockBulkOperations.length > 0) {
    await Product.bulkWrite(stockBulkOperations);
  }

  // 6. Create order
  const order = new Order({
    userId: new mongoose.Types.ObjectId(userId),
    items: verifiedItems,
    shippingAddress: input.shippingAddress,
    itemsPrice: calculatedItemsPrice,
    shippingPrice,
    taxPrice,
    discountAmount: calculatedDiscount,
    totalAmount,
    paymentMethod: input.paymentMethod,
    couponCode: appliedCouponCode,
    bkashNumber: input.bkashNumber,
    bkashTxnId: input.bkashTxnId,
    status: 'PENDING',
  });

  const savedOrder = await order.save();
  invalidateStatsCache();

  return savedOrder;
}

/**
 * Restores product stock when an order is cancelled or returned.
 */
export async function restoreOrderStock(order: IOrder): Promise<void> {
  const stockBulkOperations = order.items.map((item) => ({
    updateOne: {
      filter: { _id: item.productId, 'variants.sku': item.variantSku },
      update: { $inc: { 'variants.$.stock': item.quantity } },
    },
  }));

  if (stockBulkOperations.length > 0) {
    await Product.bulkWrite(stockBulkOperations);
  }
}

/**
 * Updates order status and handles stock adjustment on cancellation.
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: IOrder['status'],
  operator?: { userId?: string; email?: string; name?: string }
): Promise<IOrder> {
  const order = await Order.findById(orderId);
  if (!order) {
    throw AppError.notFound('Order not found');
  }

  const previousStatus = order.status;
  order.status = newStatus;

  if (newStatus === 'DELIVERED') {
    order.isDelivered = true;
    order.deliveredAt = new Date();
  }

  // Record into order's own chronological status history
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({
    status: newStatus,
    changedBy: operator?.email || 'admin@jeansloop.com',
    changedByName: operator?.name || 'Staff / Admin',
    changedAt: new Date(),
  });

  // If cancelling or returning from an active state, restore inventory
  if ((newStatus === 'CANCELLED' || newStatus === 'RETURNED') && previousStatus !== 'CANCELLED' && previousStatus !== 'RETURNED') {
    await restoreOrderStock(order);
  }

  const updated = await order.save();
  invalidateStatsCache();
  return updated;
}

/**
 * Updates order details (address, exchange, bKash txn) safely.
 */
export async function updateOrderDetails(orderId: string, data: UpdateOrderDetailsInput): Promise<IOrder> {
  const order = await Order.findById(orderId);
  if (!order) {
    throw AppError.notFound('Order not found');
  }

  if (data.shippingAddress) {
    order.shippingAddress = {
      ...order.shippingAddress,
      ...data.shippingAddress,
    };
  }

  if (data.exchangeAmount !== undefined) {
    order.exchangeAmount = data.exchangeAmount;
  }
  if (data.bkashNumber !== undefined) {
    order.bkashNumber = data.bkashNumber;
  }
  if (data.bkashTxnId !== undefined) {
    order.bkashTxnId = data.bkashTxnId;
  }

  const updated = await order.save();
  return updated;
}
