import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/User';

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

    // Dynamically ensure permissions and latest role are synced from DB for staff accounts
    if (['MANAGER', 'STAFF'].includes(req.user.role) && (!req.user.permissions || req.user.permissions.length === 0)) {
      const dbUser = await User.findById(req.user.userId).select('permissions role');
      if (dbUser) {
        req.user.permissions = dbUser.permissions || [];
        req.user.role = dbUser.role;
      }
    }
  } catch {
    throw AppError.unauthorized('Token is invalid or expired');
  }

  return next();
});

/**
 * admin — must be called AFTER protect.
 * Allows ADMIN, SUPER_ADMIN, MANAGER, and STAFF to access the admin API ecosystem.
 */
export const admin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }

  const allowed: string[] = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'STAFF'];
  if (!allowed.includes(req.user.role)) {
    next(AppError.forbidden('Admin or staff access required'));
    return;
  }

  next();
};

/**
 * strictAdmin — must be called AFTER protect.
 * Allows ADMIN and SUPER_ADMIN only (used for user directory & role access controls).
 */
export const strictAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    next(AppError.forbidden('Full administrator privileges required'));
    return;
  }
  next();
};

/**
 * checkPermission — enforces granular access control for Manager / Staff roles.
 * Full administrators (ADMIN, SUPER_ADMIN) bypass all checks.
 */
export const checkPermission = (permission: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    // Admins have unrestricted access to all modules
    if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN') {
      return next();
    }

    // For Manager / Staff, check permission array
    const perms = req.user.permissions || [];
    if (perms.includes(permission) || perms.includes('*')) {
      return next();
    }

    next(AppError.forbidden(`Access Denied: Missing "${permission}" permission`));
  };
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
