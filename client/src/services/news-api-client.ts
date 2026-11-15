/**
 * Public news feed client.
 *
 * The server reads the current InfoMoney RSS feed and returns both sides of
 * the filter: stories that stay in the RSS document and stories that are
 * removed, including the category that caused each exclusion.
 */

import { BASE_URL } from './api-client';

export interface NewsFeedItem {
  id: string;
  title: string;
  link: string;
  publishedAt: string | null;
  categories: string[];
  summary: string;
}

export interface ExcludedNewsFeedItem extends NewsFeedItem {
  /** Feed categories that matched the active filter. */
  matchedCategories: string[];
}

export interface NewsFeedResponse {
  title: string;
  lastBuildDate: string | null;
  filter: string[];
  included: NewsFeedItem[];
  excluded: ExcludedNewsFeedItem[];
  /** The filtered RSS document served by /news/feed. */
  xml: string;
}

export async function fetchNewsFeed(signal?: AbortSignal): Promise<NewsFeedResponse> {
  const res = await fetch(`${BASE_URL}/api/news`, signal ? { signal } : {});

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `HTTP ${String(res.status)}`;
    throw new Error(message);
  }

  const body: unknown = await res.json();
  return body as NewsFeedResponse;
}
