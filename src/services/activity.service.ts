import mongoose from 'mongoose';
import { ActivityLog, ActivityAction, EntityType } from '../models/ActivityLog';
import { User } from '../models/User';
import { escapeRegex } from '../utils/escapeRegex';

export interface RecordActivityInput {
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: ActivityAction | string;
  entityType: EntityType | string;
  entityId?: string;
  entityTitle?: string;
  description: string;
  details?: Record<string, any>;
}

/**
 * Non-blocking helper to log an administrative action.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    let name = input.userName;
    let email = input.userEmail;
    let role = input.userRole;

    // If user details not fully provided, resolve from User collection
    if (!name || !email || !role) {
      const user = await User.findById(input.userId).select('name email role');
      if (user) {
        name = name || user.name;
        email = email || user.email;
        role = role || user.role;
      }
    }

    await ActivityLog.create({
      userId: new mongoose.Types.ObjectId(input.userId),
      userName: name || 'System / Admin',
      userEmail: email || 'admin@jeansloop.com',
      userRole: role || 'ADMIN',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      entityTitle: input.entityTitle,
      description: input.description,
      details: input.details,
    });
  } catch (err) {
    // Fail-safe: Logging should never break business logic
    console.error('[ActivityLog Error]', err);
  }
}

export interface ActivityFilterOptions {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  userId?: string;
  keyword?: string;
}

export async function queryActivityLogs(options: ActivityFilterOptions) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const filter: any = {};

  if (options.entityType && options.entityType !== 'ALL') {
    filter.entityType = options.entityType.toUpperCase();
  }

  if (options.entityId) {
    filter.entityId = options.entityId;
  }

  if (options.userId) {
    filter.userId = new mongoose.Types.ObjectId(options.userId);
  }

  if (options.keyword) {
    const escaped = escapeRegex(options.keyword);
    filter.$or = [
      { userName: { $regex: escaped, $options: 'i' } },
      { userEmail: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
      { entityTitle: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [logs, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}
