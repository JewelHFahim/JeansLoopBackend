import { User, IUser } from '../models/User';
import { RegisterInput, LoginInput, UpdateProfileInput, ChangePasswordInput } from '../schemas/auth.schema';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import type { AuthPayload } from '../types/express';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    address?: string;
  };
}

function formatUserResponse(user: IUser) {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    address: user.address,
  };
}

export async function registerUser(input: RegisterInput): Promise<AuthTokens> {
  const existingUser = await User.findOne({ email: input.email });
  if (existingUser) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_IN_USE');
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.password,
    role: 'CUSTOMER',
  });

  const payload: AuthPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: formatUserResponse(user),
  };
}

export async function loginUser(input: LoginInput): Promise<AuthTokens> {
  // Explicitly select password field since it has select: false by default
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const payload: AuthPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: formatUserResponse(user),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; user: ReturnType<typeof formatUserResponse> }> {
  let decoded: AuthPayload;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Refresh token is invalid or expired', 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    throw AppError.unauthorized('User associated with this token no longer exists', 'USER_NOT_FOUND');
  }

  const newPayload: AuthPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(newPayload);

  return {
    accessToken,
    user: formatUserResponse(user),
  };
}

export async function updateUserProfile(userId: string, input: UpdateProfileInput): Promise<ReturnType<typeof formatUserResponse>> {
  const user = await User.findById(userId);
  if (!user) {
    throw AppError.notFound('User not found');
  }

  if (input.name) user.name = input.name;
  if (input.phone) user.phone = input.phone;
  if (input.address !== undefined) user.address = input.address;
  if (input.gender) user.gender = input.gender;
  if (input.birthDate !== undefined) user.birthDate = input.birthDate ? new Date(input.birthDate) : undefined;

  await user.save();
  return formatUserResponse(user);
}

export async function changeUserPassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw AppError.notFound('User not found');
  }

  const isMatch = await user.comparePassword(input.currentPassword);
  if (!isMatch) {
    throw AppError.badRequest('Current password does not match', 'INCORRECT_PASSWORD');
  }

  user.password = input.newPassword;
  await user.save();
}
