import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { AuthPayload } from '../types/express';

/**
 * Signs a short-lived access token (15 min by default).
 * Uses env.JWT_SECRET — guaranteed non-null by env validation.
 */
export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Signs a long-lived refresh token (7 days by default).
 * Stored in an HttpOnly cookie — never exposed to JS.
 */
export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

/** Verifies an access token. Returns the decoded payload or throws. */
export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}

/** Verifies a refresh token. Returns the decoded payload or throws. */
export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload;
}
