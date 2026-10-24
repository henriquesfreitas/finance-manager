import type { RequestHandler } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Reject state-changing API requests that do not come from the configured UI origin. */
export function createCsrfMiddleware(trustedOrigin: string): RequestHandler {
  const expectedOrigin = new URL(trustedOrigin).origin;

  return (req, res, next): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.get('origin');
    const referer = req.get('referer');
    let requestOrigin: string | undefined;

    try {
      if (origin) {
        requestOrigin = new URL(origin).origin;
      } else if (referer) {
        requestOrigin = new URL(referer).origin;
      }
    } catch {
      // Malformed origin metadata is not evidence of a trusted request.
    }

    if (requestOrigin !== expectedOrigin) {
      res.status(403).json({ error: 'Invalid request origin' });
      return;
    }

    next();
  };
}
