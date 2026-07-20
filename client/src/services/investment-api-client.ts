import type {
  ArchivedInvestmentItem,
  InvestmentListItem,
  InvestmentRecord,
} from '../types/investment';

/**
 * Base URL comes from the Vite env variable.
 * Falls back to localhost:3000 so tests / local dev work without a .env file.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
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

  // 204 No Content — return empty object cast to T
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

/**
 * Fetches all active investments enriched with computed position and live market quotes.
 * GET /api/investments
 */
export function fetchActiveInvestments(): Promise<InvestmentListItem[]> {
  return request<InvestmentListItem[]>('/api/investments');
}

/**
 * Fetches all archived investments with their final computed position.
 * GET /api/investments/archived
 */
export function fetchArchivedInvestments(): Promise<ArchivedInvestmentItem[]> {
  return request<ArchivedInvestmentItem[]>('/api/investments/archived');
}

/**
 * Creates a new investment by ticker and sector, returns the stored record.
 * POST /api/investments
 *
 * @example createInvestment('ITUB3', 'Bancos')
 */
export function createInvestment(ticker: string, sector: string): Promise<InvestmentRecord> {
  return request<InvestmentRecord>('/api/investments', {
    method: 'POST',
    body: JSON.stringify({ ticker, sector }),
  });
}

/**
 * Updates the sector of an existing investment.
 * PATCH /api/investments/:id/sector
 *
 * @example updateInvestmentSector('some-uuid', 'Tecnologia')
 */
export function updateInvestmentSector(id: string, sector: string): Promise<InvestmentRecord> {
  return request<InvestmentRecord>(`/api/investments/${id}/sector`, {
    method: 'PATCH',
    body: JSON.stringify({ sector }),
  });
}

/**
 * Soft-deletes an investment by setting its archivedAt timestamp.
 * PATCH /api/investments/:id/archive
 *
 * @example archiveInvestment('some-uuid')
 */
export function archiveInvestment(id: string): Promise<InvestmentRecord> {
  return request<InvestmentRecord>(`/api/investments/${id}/archive`, {
    method: 'PATCH',
  });
}

/**
 * Updates the target sell and/or buy prices for an investment.
 * Pass null for a field to clear it.
 * PATCH /api/investments/:id/target-prices
 *
 * @example updateTargetPrices('some-uuid', { targetSellPrice: 35.5, targetBuyPrice: 28.0 })
 */
export function updateTargetPrices(
  id: string,
  data: { targetSellPrice?: number | null; targetBuyPrice?: number | null },
): Promise<InvestmentRecord> {
  return request<InvestmentRecord>(`/api/investments/${id}/target-prices`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
