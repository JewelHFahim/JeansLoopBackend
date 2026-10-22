import mongoose, { Schema, Document } from 'mongoose';

export type ActivityAction =
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_DETAILS_UPDATED'
  | 'ORDER_MARKED_PAID'
  | 'ORDER_MARKED_DELIVERED'
  | 'ORDER_DELETED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'STAFF_CREATED'
  | 'USER_ROLE_UPDATED'
  | 'USER_DELETED'
  | 'SETTINGS_UPDATED';

export type EntityType = 'ORDER' | 'PRODUCT' | 'USER' | 'SETTINGS' | 'COUPON' | 'CATEGORY' | 'SLIDER';

export interface IActivityLog extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  userRole: string;
  action: ActivityAction | string;
  entityType: EntityType | string;
  entityId?: string;
  entityTitle?: string;
  description: string;
  details?: Record<string, any>;
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    userRole: { type: String, required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    entityTitle: { type: String },
    description: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ entityType: 1, entityId: 1 });
ActivityLogSchema.index({ userId: 1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
