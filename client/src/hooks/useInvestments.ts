import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  fetchActiveInvestmentRecords,
  fetchActiveInvestmentQuotes,
  fetchArchivedInvestments,
  createInvestment,
  archiveInvestment,
  updateInvestmentSector,
  updateInvestmentRecommendation,
  updateTargetPrices,
  fetchTreasuryProducts,
  createTreasuryInvestment,
  updateCurrentValue,
} from '../services/investment-api-client';
import type {
  ArchivedInvestmentItem,
  InvestmentListItem,
  InvestmentRecord,
  TreasuryProduct,
} from '../types/investment';

/** Cache key for the active investments list. */
export const ACTIVE_INVESTMENTS_QUERY_KEY = ['investments', 'active'] as const;

/** Cache key for the archived investments list. */
export const ARCHIVED_INVESTMENTS_QUERY_KEY = ['investments', 'archived'] as const;

/**
 * Fetches stored investment data first, then loads live market quotes in a
 * separate query so the UI can show tickers while prices are still loading.
 * Both queries are stale after 5 minutes, matching the server-side quote cache TTL.
 */
export type ActiveInvestmentsQueryResult = {
  data: InvestmentListItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: UseQueryResult<InvestmentListItem[], Error>['refetch'];
  pricesLoading: boolean;
};

export function useActiveInvestments(): ActiveInvestmentsQueryResult {
  const investmentsQuery = useQuery({
    queryKey: ACTIVE_INVESTMENTS_QUERY_KEY,
    queryFn: fetchActiveInvestmentRecords,
    staleTime: 1000 * 60 * 5,
  });
  const stockTickers = investmentsQuery.data
    ?.filter((investment) => investment.type === 'STOCK')
    .map((investment) => investment.ticker)
    .sort() ?? [];
  const tickerKey = stockTickers.join('|');
  const quotesQuery = useQuery({
    queryKey: ['investments', 'quotes', tickerKey],
    queryFn: fetchActiveInvestmentQuotes,
    enabled: investmentsQuery.data !== undefined && stockTickers.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const data = investmentsQuery.data?.map((investment) => ({
    ...investment,
    quote: investment.type === 'STOCK' ? (quotesQuery.data?.[investment.ticker] ?? null) : null,
  }));

  return {
    data,
    isLoading: investmentsQuery.isLoading,
    isError: investmentsQuery.isError,
    error: investmentsQuery.error,
    refetch: investmentsQuery.refetch,
    pricesLoading: stockTickers.length > 0 && quotesQuery.isPending,
  };
}

/**
 * Fetches all archived investments with their final computed position.
 * Stale after 5 minutes — archived data changes infrequently.
 */
export function useArchivedInvestments(): UseQueryResult<ArchivedInvestmentItem[], Error> {
  return useQuery({
    queryKey: ARCHIVED_INVESTMENTS_QUERY_KEY,
    queryFn: fetchArchivedInvestments,
    staleTime: 1000 * 60 * 5,
  });
}

/** Input shape for creating an investment. */
export interface CreateInvestmentInput {
  ticker: string;
  sector: string;
}

/**
 * Creates a new investment and invalidates the active list on success.
 *
 * @example mutate({ ticker: 'ITUB3', sector: 'Bancos' })
 */
export function useCreateInvestment(): UseMutationResult<InvestmentRecord, Error, CreateInvestmentInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticker, sector }: CreateInvestmentInput) => createInvestment(ticker, sector),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY }),
  });
}

/**
 * Archives an investment by id and invalidates both active and archived lists on success.
 *
 * @example mutate('some-uuid')
 */
export function useArchiveInvestment(): UseMutationResult<InvestmentRecord, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveInvestment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ARCHIVED_INVESTMENTS_QUERY_KEY });
    },
  });
}

/**
 * Updates the sector of an investment and invalidates both active and archived lists.
 *
 * @example mutate({ id: 'some-uuid', sector: 'Tecnologia' })
 */
export function useUpdateInvestmentSector(): UseMutationResult<
  InvestmentRecord,
  Error,
  { id: string; sector: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sector }: { id: string; sector: string }) =>
      updateInvestmentSector(id, sector),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ARCHIVED_INVESTMENTS_QUERY_KEY });
    },
  });
}

/** Input shape for updating target prices. */
export interface UpdateTargetPricesInput {
  id: string;
  targetSellPrice?: number | null;
  targetBuyPrice?: number | null;
  targetBuyQuantity?: number | null;
}

/** Saves the recommendation score and refreshes active and archived ticker colors. */
export function useUpdateInvestmentRecommendation(): UseMutationResult<
  InvestmentRecord,
  Error,
  { id: string; recommendation: number | null }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recommendation }) => updateInvestmentRecommendation(id, recommendation),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ARCHIVED_INVESTMENTS_QUERY_KEY });
    },
  });
}

/**
 * Updates the target sell/buy prices of an investment.
 * Invalidates the active investments list on success so the table refreshes.
 *
 * @example mutateAsync({ id: 'some-uuid', targetSellPrice: 35.5 })
 */
export function useUpdateTargetPrices(): UseMutationResult<
  InvestmentRecord,
  Error,
  UpdateTargetPricesInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTargetPricesInput) => updateTargetPrices(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY }),
  });
}

/** Cache key for the treasury products catalog. */
export const TREASURY_PRODUCTS_QUERY_KEY = ['treasury-products'] as const;

/**
 * Fetches the catalog of available Tesouro Direto products.
 * Stale after 30 minutes — the catalog changes infrequently.
 *
 * @example const { data: products } = useTreasuryProducts();
 */
export function useTreasuryProducts(): UseQueryResult<TreasuryProduct[], Error> {
  return useQuery({
    queryKey: TREASURY_PRODUCTS_QUERY_KEY,
    queryFn: fetchTreasuryProducts,
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Creates a new TREASURY investment from a product catalog entry.
 * Invalidates the active investments list on success.
 *
 * @example mutate('prod-uuid')
 */
export function useCreateTreasuryInvestment(): UseMutationResult<InvestmentRecord, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (treasuryProductId: string) => createTreasuryInvestment(treasuryProductId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY }),
  });
}

/** Input shape for updating current value. */
export interface UpdateCurrentValueInput {
  id: string;
  currentValue: number | null;
}

/**
 * Updates the manually-entered current value of a non-STOCK investment.
 * Invalidates the active investments list on success so the table refreshes.
 *
 * @example mutateAsync({ id: 'some-uuid', currentValue: 30882.59 })
 * @example mutateAsync({ id: 'some-uuid', currentValue: null })  // clears it
 */
export function useUpdateCurrentValue(): UseMutationResult<
  InvestmentRecord,
  Error,
  UpdateCurrentValueInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, currentValue }: UpdateCurrentValueInput) =>
      updateCurrentValue(id, currentValue),
    onSuccess: () => qc.invalidateQueries({ queryKey: ACTIVE_INVESTMENTS_QUERY_KEY }),
  });
}
