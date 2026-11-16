import type { CookieOptions } from 'express';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sessions never last less than 90 days, even if the env var asks for less. */
const MIN_SESSION_EXPIRY_DAYS = 90;

const DEFAULT_SESSION_COOKIE_NAME = 'finance_session';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the session lifetime in days from `SESSION_EXPIRY_DAYS`.
 * Falls back to 90 days when unset or invalid and never drops below 90 days.
 */
export function getSessionExpiryDays(): number {
  const configured = Number.parseInt(process.env['SESSION_EXPIRY_DAYS'] ?? '', 10);

  if (!Number.isFinite(configured)) {
    return MIN_SESSION_EXPIRY_DAYS;
  }

  return Math.max(MIN_SESSION_EXPIRY_DAYS, configured);
}

/**
 * Returns the session cookie name, honouring `SESSION_COOKIE_NAME`.
 */
export function getSessionCookieName(): string {
  return process.env['SESSION_COOKIE_NAME'] ?? DEFAULT_SESSION_COOKIE_NAME;
}

/**
 * Returns the shared attributes for issuing or refreshing the session cookie.
 */
export function getSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: getSessionExpiryDays() * MS_PER_DAY,
  };
}
