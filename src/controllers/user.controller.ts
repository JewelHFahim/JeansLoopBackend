import { Request, Response } from 'express';
import { User } from '../models/User';
import { Order } from '../models/Order';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { escapeRegex } from '../utils/escapeRegex';

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const filter: any = {};
  if (req.query.keyword) {
    const escaped = escapeRegex(String(req.query.keyword));
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  // Optionally fetch order counts for these specific paginated users only (not all users at once)
  const userIds = users.map((u) => u._id);
  const orderCounts = await Order.aggregate([
    { $match: { userId: { $in: userIds } } },
    { $group: { _id: '$userId', count: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' } } },
  ]);

  const countMap = new Map<string, { count: number; totalSpent: number }>();
  orderCounts.forEach((c) => countMap.set(c._id.toString(), { count: c.count, totalSpent: c.totalSpent }));

  const enrichedUsers = users.map((u) => {
    const stats = countMap.get(u._id.toString()) || { count: 0, totalSpent: 0 };
    return {
      _id: u._id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      address: u.address,
      role: u.role,
      orderCount: stats.count,
      totalSpent: stats.totalSpent,
      createdAt: u.createdAt,
    };
  });

  sendPaginated(res, enrichedUsers, {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (id === req.user!.userId) {
    throw AppError.badRequest('You cannot delete your own account');
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw AppError.notFound('User not found');
  }

  sendSuccess(res, null, 'User deleted successfully');
});
