import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  updateUserProfile,
  changeUserPassword,
} from '../services/auth.service';
import { User } from '../models/User';
import { env } from '../config/env';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);
  res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, { user: result.user, token: result.accessToken }, 'Registration successful', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await loginUser(req.body);
  res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, { user: result.user, token: result.accessToken }, 'Login successful');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    throw AppError.unauthorized('No refresh token provided');
  }

  const result = await refreshAccessToken(refreshToken);
  sendSuccess(res, { user: result.user, token: result.accessToken });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', { httpOnly: true, secure: env.NODE_ENV === 'production' });
  sendSuccess(res, null, 'Logged out successfully');
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId);
  if (!user) {
    throw AppError.notFound('User not found');
  }
  sendSuccess(res, {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions || [],
    phone: user.phone,
    address: user.address,
    gender: user.gender,
    birthDate: user.birthDate,
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const updatedUser = await updateUserProfile(req.user!.userId, req.body);
  sendSuccess(res, updatedUser, 'Profile updated successfully');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await changeUserPassword(req.user!.userId, req.body);
  sendSuccess(res, null, 'Password updated successfully');
});
