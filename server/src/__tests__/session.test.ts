import { describe, it, expect, afterEach } from 'vitest';
import {
  getSessionCookieName,
  getSessionCookieOptions,
  getSessionExpiryDays,
} from '../lib/session.js';

afterEach(() => {
  delete process.env['SESSION_EXPIRY_DAYS'];
  delete process.env['SESSION_COOKIE_NAME'];
});

describe('getSessionExpiryDays', () => {
  it('defaults to 90 days when SESSION_EXPIRY_DAYS is unset', () => {
    expect(getSessionExpiryDays()).toBe(90);
  });

  it('defaults to 90 days when SESSION_EXPIRY_DAYS is invalid', () => {
    process.env['SESSION_EXPIRY_DAYS'] = 'not-a-number';
    expect(getSessionExpiryDays()).toBe(90);
  });

  it('never allows a lifetime shorter than 90 days', () => {
    process.env['SESSION_EXPIRY_DAYS'] = '7';
    expect(getSessionExpiryDays()).toBe(90);
  });

  it('honours a configured lifetime longer than 90 days', () => {
    process.env['SESSION_EXPIRY_DAYS'] = '180';
    expect(getSessionExpiryDays()).toBe(180);
  });
});

describe('getSessionCookieName', () => {
  it('defaults to finance_session', () => {
    expect(getSessionCookieName()).toBe('finance_session');
  });

  it('honours SESSION_COOKIE_NAME', () => {
    process.env['SESSION_COOKIE_NAME'] = 'custom_session';
    expect(getSessionCookieName()).toBe('custom_session');
  });
});

describe('getSessionCookieOptions', () => {
  it('returns secure cookie attributes with a 90-day max-age in milliseconds', () => {
    expect(getSessionCookieOptions()).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });
  });
});
