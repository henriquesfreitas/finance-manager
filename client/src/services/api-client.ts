/**
 * Shared HTTP helpers for all API client modules.
 *
 * BASE_URL is read from the Vite env variable at build time.
 * Falls back to localhost:3000 so local dev and tests work without a .env file.
 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/**
 * Thin fetch wrapper that:
 * - Attaches Content-Type: application/json
 * - Throws a descriptive Error when the response is not ok (uses `error` field
 *   from the JSON body when available, otherwise falls back to `HTTP <status>`)
 * - Returns `undefined` for 204 No Content responses
 *
 * Usage:
 *   const items = await request<OrderListItem[]>('/api/investments/abc/orders');
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}
