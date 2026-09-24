/**
 * Tests for investment-api-client.ts
 *
 * Key concern: the request() helper must pass `credentials: 'include'` on every
 * fetch call so session cookies are sent in cross-origin dev (client :5173 → server :3000).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchActiveInvestments,
  fetchActiveInvestmentRecords,
  fetchActiveInvestmentQuotes,
  fetchArchivedInvestments,
  createInvestment,
} from '../services/investment-api-client';

// Minimal successful fetch response
function makeFetchResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('investment-api-client — credentials', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends credentials: include on GET requests', async () => {
    fetchSpy.mockResolvedValue(makeFetchResponse([]));

    await fetchActiveInvestments();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
  });

  it('fetches active ticker records through the fast data endpoint', async () => {
    fetchSpy.mockResolvedValue(makeFetchResponse([]));

    await fetchActiveInvestmentRecords();

    expect(fetchSpy.mock.calls[0]?.[0]).toContain('/api/investments/active-data');
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).credentials).toBe('include');
  });

  it('fetches market quotes through the separate quote endpoint', async () => {
    fetchSpy.mockResolvedValue(makeFetchResponse({ ITUB3: null }));

    await fetchActiveInvestmentQuotes();

    expect(fetchSpy.mock.calls[0]?.[0]).toContain('/api/investments/quotes');
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).credentials).toBe('include');
  });

  it('sends credentials: include on archived GET requests', async () => {
    fetchSpy.mockResolvedValue(makeFetchResponse([]));

    await fetchArchivedInvestments();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
  });

  it('sends credentials: include on POST requests', async () => {
    fetchSpy.mockResolvedValue(makeFetchResponse({ id: '1', ticker: 'ITUB3' }));

    await createInvestment('ITUB3', 'Bancos');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
  });

  it('preserves caller-supplied init options alongside credentials', async () => {
    fetchSpy.mockResolvedValue(makeFetchResponse({ id: '1', ticker: 'ITUB3' }));

    await createInvestment('ITUB3', 'Bancos');

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    // Method from the caller must still be present
    expect(init.method).toBe('POST');
    // Content-Type must still be injected
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});
