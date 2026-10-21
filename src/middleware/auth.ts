import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * protect — verifies the Bearer token and attaches req.user.
 * Returns 401 if token is missing or invalid.
 */
export const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
  } catch {
    throw AppError.unauthorized('Token is invalid or expired');
  }

  return next();
});

/**
 * admin — must be called AFTER protect.
 * Allows ADMIN and SUPER_ADMIN only.
 */
export const admin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }

  const allowed: string[] = ['ADMIN', 'SUPER_ADMIN'];
  if (!allowed.includes(req.user.role)) {
    next(AppError.forbidden('Admin access required'));
    return;
  }

  next();
};

/**
 * superAdmin — must be called AFTER protect.
 * Allows SUPER_ADMIN only.
 */
export const superAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    next(AppError.forbidden('Super admin access required'));
    return;
  }
  next();
};
