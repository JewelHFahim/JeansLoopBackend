import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

// Augment Express Request with a typed `user` property set by auth middleware
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
