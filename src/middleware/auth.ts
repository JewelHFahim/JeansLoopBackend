import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import { User } from '../models/User';

/**
 * protect — verifies the Bearer token, ensures user exists in DB, and attaches current role & permissions.
 * Returns 401 if token is missing, invalid, expired, or if account was deleted/revoked.
 */
export const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw AppError.unauthorized('No token provided');
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw AppError.unauthorized('Token is invalid or expired');
  }

  // Verify user still exists in the database and synchronize real-time role & permissions
  const dbUser = await User.findById(payload.userId).select('role permissions email');
  if (!dbUser) {
    throw AppError.unauthorized('User account associated with this token no longer exists');
  }

  req.user = {
    userId: payload.userId,
    email: dbUser.email,
    role: dbUser.role,
    permissions: dbUser.permissions || [],
  };

  return next();
});

/**
 * optionalAuth — extracts and attaches req.user if a valid token is present, but does not block requests without one.
 */
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token);
      req.user = payload;
    } catch {
      // Silently proceed for optional auth
    }
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
