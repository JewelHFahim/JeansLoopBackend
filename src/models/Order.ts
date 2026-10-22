import mongoose, { Schema, Document } from 'mongoose';
import type { OrderStatus, PaymentMethod } from '../types';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  variantSku: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  size?: string;
  color?: string;
}

export interface IShippingAddress {
  fullName: string;
  phone: string;
  altPhone?: string;
  street: string;
  city: string;
  country: string;
  note?: string;
}

export interface IOrderStatusHistory {
  status: OrderStatus;
  changedBy: string;
  changedByName?: string;
  changedAt: Date;
  note?: string;
}

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  discountAmount: number;
  totalAmount: number;
  exchangeAmount: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  paidAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  status: OrderStatus;
  statusHistory?: IOrderStatusHistory[];
  couponCode?: string;
  bkashNumber?: string;
  bkashTxnId?: string;
  trackingNumber?: string;
  paymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantSku: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String },
    size: { type: String },
    color: { type: String },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    altPhone: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, default: 'Bangladesh' },
    note: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [OrderItemSchema], required: true },
    shippingAddress: { type: ShippingAddressSchema, required: true },
    itemsPrice: { type: Number, required: true, min: 0 },
    shippingPrice: { type: Number, required: true, min: 0 },
    taxPrice: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    exchangeAmount: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ['cod', 'bkash', 'card'], default: 'cod' },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'COURIERED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'EXCHANGE'],
      default: 'PENDING',
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: String, required: true },
        changedByName: { type: String },
        changedAt: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    couponCode: { type: String, uppercase: true, trim: true },
    bkashNumber: { type: String, trim: true },
    bkashTxnId: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    paymentIntentId: { type: String },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ 'shippingAddress.city': 1 });
OrderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
