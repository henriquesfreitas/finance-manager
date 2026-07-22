/**
 * Auth API client for authentication endpoints.
 * Follows the investment-api-client.ts pattern but adds `credentials: 'include'`
 * so the browser sends/receives httpOnly session cookies cross-origin.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface AdminIdentity {
  id: string;
  username: string;
}

interface AuthResponse {
  admin: AdminIdentity;
}

/**
 * Fetch wrapper for auth endpoints.
 * Always includes `credentials: 'include'` for httpOnly cookie transmission.
 */
async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (body as { error?: string }).error ?? `HTTP ${res.status}`,
    );
  }

  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

/**
 * Authenticates with username and password.
 * On success the server sets a httpOnly session cookie.
 * POST /api/auth/login
 *
 * @example login('admin', 'SecureP@ss123')
 */
export function login(username: string, password: string): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

/**
 * Invalidates the current session and clears the session cookie.
 * POST /api/auth/logout
 *
 * @example logout()
 */
export function logout(): Promise<void> {
  return authRequest<void>('/api/auth/logout', {
    method: 'POST',
  });
}

/**
 * Returns the currently authenticated admin's identity by validating the session cookie.
 * Used to restore auth state on page load.
 * GET /api/auth/me
 *
 * @example fetchCurrentAdmin()
 */
export function fetchCurrentAdmin(): Promise<AuthResponse> {
  return authRequest<AuthResponse>('/api/auth/me');
}
