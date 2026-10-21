import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError';

type Target = 'body' | 'query' | 'params';

/**
 * Generic Zod validation middleware factory.
 * Usage: router.post('/route', validate(MySchema), handler)
 *        router.get('/route', validate(MyQuerySchema, 'query'), handler)
 */
export function validate(schema: ZodSchema, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = (result.error as ZodError).errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');

      return next(AppError.badRequest(`Validation failed: ${errors}`, 'VALIDATION_ERROR'));
    }

    // In Express 5, req.query is a getter property on IncomingMessage,
    // so we use Object.defineProperty to override it safely with parsed/coerced values.
    if (target === 'query' || target === 'params') {
      Object.defineProperty(req, target, {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    } else {
      req.body = result.data;
    }

    next();
  };
}
