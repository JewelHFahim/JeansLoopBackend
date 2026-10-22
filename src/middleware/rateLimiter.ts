import rateLimit from 'express-rate-limit';

/** General API limiter: 1,000 requests per 15 minutes per IP (supports multiple users on shared Wi-Fi) */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

/** Auth limiter: 10 attempts per 15 minutes per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later', code: 'AUTH_RATE_LIMITED' },
  skipSuccessfulRequests: true,
});

/** Upload limiter: 30 uploads per hour */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Upload limit reached, please try again in an hour', code: 'UPLOAD_RATE_LIMITED' },
});
