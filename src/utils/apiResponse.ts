import { Response } from 'express';
import type { PaginationMeta } from '../types';

/** Uniform success response */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): void {
  res.status(statusCode).json({ success: true, data, ...(message ? { message } : {}) });
}

/** Uniform paginated response */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
): void {
  res.status(200).json({ success: true, data, pagination });
}

/** Uniform error response (used by error middleware) */
export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  code = 'INTERNAL_ERROR',
): void {
  res.status(statusCode).json({ success: false, message, code });
}
