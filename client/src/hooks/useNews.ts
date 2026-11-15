import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchNewsFeed, type NewsFeedResponse } from '../services/news-api-client';

export const NEWS_FEED_QUERY_KEY = ['news', 'feed'] as const;

export function useNewsFeed(): UseQueryResult<NewsFeedResponse> {
  return useQuery({
    queryKey: NEWS_FEED_QUERY_KEY,
    queryFn: ({ signal }) => fetchNewsFeed(signal),
    // The page should reflect the feed at load time; the server does not cache.
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
