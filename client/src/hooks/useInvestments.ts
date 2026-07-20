import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  fetchActiveInvestments,
  fetchArchivedInvestments,
  createInvestment,
  archiveInvestment,
  updateInvestmentSector,
  updateTargetPrices,
} from '../services/investment-api-client';
import type { ArchivedInvestmentItem, InvestmentListItem, InvestmentRecord } from '../types/investment';

/** Cache key for the active investments list. */
export const ACTIVE_INVESTMENTS_QUERY_KEY = ['investments', 'active'] as const;

/** Cache key for the archived investments list. */
export const ARCHIVED_INVESTMENTS_QUERY_KEY = ['investments', 'archived'] as const;

/**
 * Fetches all active investments enriched with computed position and live market quotes.
 * Stale after 5 minutes, matching the server-side quote cache TTL.
 */
export function useActiveInvestments(): UseQueryResult<InvestmentListItem[], Error> {
  return useQuery({
    queryKey: ACTIVE_INVESTMENTS_QUERY_KEY,
    queryFn: fetchActiveInvestments,
    staleTime: 1000 * 60 * 5,
  });
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
