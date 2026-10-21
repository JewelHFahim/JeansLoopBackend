import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/apiResponse';
import { env } from '../config/env';

/**
 * Central error handling middleware.
 * Must be registered LAST in Express (after all routes).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Known operational errors (thrown intentionally via AppError)
  if (err instanceof AppError && err.isOperational) {
    sendError(res, err.message, err.statusCode, err.code);
    return;
  }

  // Mongoose validation errors
  if (isMongooseValidationError(err)) {
    const messages = Object.values((err as MongooseValidationError).errors)
      .map((e) => e.message)
      .join('; ');
    sendError(res, `Validation failed: ${messages}`, 400, 'VALIDATION_ERROR');
    return;
  }

  // Mongoose duplicate key (E11000)
  if (isMongooseDuplicateKeyError(err)) {
    const field = Object.keys((err as MongooseDuplicateKeyError).keyValue)[0];
    sendError(res, `A record with this ${field} already exists`, 409, 'DUPLICATE_KEY');
    return;
  }

  // Mongoose cast error (invalid ObjectId, etc.)
  if (isMongooseCastError(err)) {
    sendError(res, `Invalid ${(err as MongooseCastError).path}: ${(err as MongooseCastError).value}`, 400, 'INVALID_ID');
    return;
  }

  // JSON Web Token errors
  if (err instanceof Error && err.name === 'JsonWebTokenError') {
    sendError(res, 'Invalid token', 401, 'INVALID_TOKEN');
    return;
  }
  if (err instanceof Error && err.name === 'TokenExpiredError') {
    sendError(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    return;
  }

  // Unknown / programming errors — log in full, hide details from client
  console.error('💥  Unexpected error:', err);

  const message = env.NODE_ENV === 'development' && err instanceof Error
    ? err.message
    : 'An unexpected error occurred';

  sendError(res, message, 500, 'INTERNAL_ERROR');
}

// ─── Type guards for Mongoose errors ──────────────────────

interface MongooseValidationError {
  name: string;
  errors: Record<string, { message: string }>;
}
function isMongooseValidationError(err: unknown): err is MongooseValidationError {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'ValidationError';
}

interface MongooseDuplicateKeyError {
  code: number;
  keyValue: Record<string, unknown>;
}
function isMongooseDuplicateKeyError(err: unknown): err is MongooseDuplicateKeyError {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

interface MongooseCastError {
  name: string;
  path: string;
  value: unknown;
}
function isMongooseCastError(err: unknown): err is MongooseCastError {
  return typeof err === 'object' && err !== null && (err as { name?: string }).name === 'CastError';
}
