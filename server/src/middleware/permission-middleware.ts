import type { AppPermission } from '@prisma/client';
import type { RequestHandler } from 'express';

/** Rejects authenticated sessions that do not have the requested permission. */
export function requirePermission(permission: AppPermission): RequestHandler {
  return (req, res, next): void => {
    if (!req.permissions?.includes(permission)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    next();
  };
}
