import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { fetchNews, fetchNewsOriginalText, syncNews } from '../services/news-api-client';
import type { NewsOriginalText, NewsPageData, NewsSyncStats } from '../types/news';

export const NEWS_QUERY_KEY = ['news'] as const;

export function useNews(): UseQueryResult<NewsPageData> {
  return useQuery({
    queryKey: NEWS_QUERY_KEY,
    queryFn: fetchNews,
    refetchInterval: (query) => {
      const progress = query.state.data?.progress;
      return progress && (progress.pending > 0 || progress.processing > 0) ? 2_000 : false;
    },
  });
}

export function useSyncNews(): UseMutationResult<NewsSyncStats, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncNews,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEY }),
  });
}

export function useNewsOriginalText(itemId: string, enabled: boolean): UseQueryResult<NewsOriginalText> {
  return useQuery({
    queryKey: [...NEWS_QUERY_KEY, 'original-text', itemId],
    queryFn: () => fetchNewsOriginalText(itemId),
    enabled,
    staleTime: Infinity,
  });
}
