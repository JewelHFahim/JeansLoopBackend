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
      permissions: u.permissions || [],
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

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone, role, permissions } = req.body;

  if (!name || !email || !password) {
    throw AppError.badRequest('Name, email, and password are required');
  }

  if (password.length < 8) {
    throw AppError.badRequest('Password must be at least 8 characters');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw AppError.conflict('An account with this email already exists');
  }

  const assignedRole = role && ['ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'].includes(role) ? role : 'MANAGER';
  const assignedPermissions = Array.isArray(permissions) ? permissions : ['orders', 'products'];

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    phone: phone?.trim(),
    role: assignedRole,
    permissions: assignedPermissions,
  });

  sendSuccess(
    res,
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions,
      createdAt: user.createdAt,
    },
    'Staff / User account created successfully',
    201
  );
});

export const updateUserRole = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, permissions } = req.body;

  if (!role || !['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER'].includes(role)) {
    throw AppError.badRequest('Valid role is required');
  }

  // Prevent self-demotion
  if (id === req.user!.userId && role !== req.user!.role) {
    throw AppError.badRequest('You cannot modify your own administrative role');
  }

  const user = await User.findById(id);
  if (!user) {
    throw AppError.notFound('User not found');
  }

  user.role = role;
  if (Array.isArray(permissions)) {
    user.permissions = permissions;
  }
  await user.save();

  sendSuccess(
    res,
    {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    },
    'User role and access permissions updated'
  );
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
