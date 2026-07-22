import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { login, logout, fetchCurrentAdmin } from '../services/auth-api-client';

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      statusText: String(status),
    }),
  );
}

function mockFetchNetworkError(): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
}

// ─── Shared assertions ────────────────────────────────────────────────────────

/**
 * Asserts that all three auth functions include `credentials: 'include'` in
 * their fetch calls — critical for httpOnly cookie transmission cross-origin.
 */
async function assertCredentialsIncluded(
  call: () => Promise<unknown>,
  fetchSpy: ReturnType<typeof vi.fn>,
): Promise<void> {
  await call().catch(() => {});
  expect(fetchSpy).toHaveBeenCalledOnce();
  const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  expect(init.credentials).toBe('include');
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── login ───────────────────────────────────────────────────────────────────

describe('login', () => {
  it('POSTs to /api/auth/login with username and password', async () => {
    const adminPayload = { admin: { id: 'uuid-1', username: 'admin' } };
    mockFetch(200, adminPayload);

    const result = await login('admin', 'SecureP@ss123');

    const fetchSpy = vi.mocked(fetch);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      username: 'admin',
      password: 'SecureP@ss123',
    });
    expect(result).toEqual(adminPayload);
  });

  it('includes credentials: "include" for cookie transmission', async () => {
    mockFetch(200, { admin: { id: 'uuid-1', username: 'admin' } });
    await assertCredentialsIncluded(
      () => login('admin', 'pass'),
      vi.mocked(fetch),
    );
  });

  it('sets Content-Type: application/json header', async () => {
    mockFetch(200, { admin: { id: 'uuid-1', username: 'admin' } });
    await login('admin', 'SecureP@ss123');

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws with server error message on 401', async () => {
    mockFetch(401, { error: 'Invalid credentials' });
    await expect(login('admin', 'wrong')).rejects.toThrow('Invalid credentials');
  });

  it('throws with server error message on 429 (rate limited)', async () => {
    mockFetch(429, { error: 'Too many login attempts. Try again in 15 minutes.' });
    await expect(login('admin', 'pass')).rejects.toThrow(
      'Too many login attempts. Try again in 15 minutes.',
    );
  });

  it('falls back to HTTP status text when server returns no error field', async () => {
    mockFetch(500, {});
    await expect(login('admin', 'pass')).rejects.toThrow('HTTP 500');
  });

  it('throws on network failure', async () => {
    mockFetchNetworkError();
    await expect(login('admin', 'pass')).rejects.toThrow('Network error');
  });
});

// ─── logout ──────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('POSTs to /api/auth/logout', async () => {
    mockFetch(204, null);

    await logout();

    const fetchSpy = vi.mocked(fetch);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/logout');
    expect(init.method).toBe('POST');
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch(204, null);
    const result = await logout();
    expect(result).toBeUndefined();
  });

  it('includes credentials: "include" for cookie transmission', async () => {
    mockFetch(204, null);
    await assertCredentialsIncluded(() => logout(), vi.mocked(fetch));
  });

  it('throws on non-OK response', async () => {
    mockFetch(401, { error: 'Authentication required' });
    await expect(logout()).rejects.toThrow('Authentication required');
  });
});

// ─── fetchCurrentAdmin ───────────────────────────────────────────────────────

describe('fetchCurrentAdmin', () => {
  it('GETs /api/auth/me and returns admin identity', async () => {
    const adminPayload = { admin: { id: 'uuid-1', username: 'admin' } };
    mockFetch(200, adminPayload);

    const result = await fetchCurrentAdmin();

    const fetchSpy = vi.mocked(fetch);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/me');
    // GET requests should not set a method (defaults to GET) or can explicitly set it
    expect(init?.method).toBeUndefined();
    expect(result).toEqual(adminPayload);
  });

  it('includes credentials: "include" for cookie transmission', async () => {
    mockFetch(200, { admin: { id: 'uuid-1', username: 'admin' } });
    await assertCredentialsIncluded(() => fetchCurrentAdmin(), vi.mocked(fetch));
  });

  it('throws with server error message on 401 (session expired)', async () => {
    mockFetch(401, { error: 'Session expired or invalid' });
    await expect(fetchCurrentAdmin()).rejects.toThrow('Session expired or invalid');
  });

  it('falls back to HTTP status text when server returns no error field', async () => {
    mockFetch(500, {});
    await expect(fetchCurrentAdmin()).rejects.toThrow('HTTP 500');
  });

  it('throws on network failure', async () => {
    mockFetchNetworkError();
    await expect(fetchCurrentAdmin()).rejects.toThrow('Network error');
  });
});
