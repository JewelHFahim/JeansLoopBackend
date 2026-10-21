import cors, { CorsOptions } from 'cors';
import { env } from './env';

const configuredOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim().toLowerCase());

/**
 * Checks whether an origin is a local loopback or local area network (LAN) address.
 * Allows developers and testers on the same Wi-Fi/LAN (e.g. 192.168.x.x, 10.x.x.x) to connect seamlessly.
 */
function isLocalOrLanOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    );
  } catch {
    return false;
  }
}

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, server-to-server, curl)
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.toLowerCase().trim();

    // 1. Explicitly configured origins from env
    if (configuredOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // 2. In development mode, automatically allow localhost and private LAN IPs (e.g. 192.168.0.x:3000)
    if (env.NODE_ENV === 'development' && isLocalOrLanOrigin(normalizedOrigin)) {
      return callback(null, true);
    }

    // Unauthorized origin: do not add CORS headers
    if (env.NODE_ENV === 'development') {
      console.warn(`[CORS] Rejected unauthorized origin in development: "${origin}"`);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
};

export const corsMiddleware = cors(corsOptions);
