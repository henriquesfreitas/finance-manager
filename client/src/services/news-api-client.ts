import { request } from './api-client';
import type { NewsOriginalText, NewsPageData, NewsSummary, NewsSyncStats } from '../types/news';

export function fetchNews(): Promise<NewsPageData> {
  return request<NewsPageData>('/api/news');
}

export function fetchNewsOriginalText(id: string): Promise<NewsOriginalText> {
  return request<NewsOriginalText>(`/api/news/${encodeURIComponent(id)}/original-text`);
}

export function summarizeNews(id: string): Promise<NewsSummary> {
  return request<NewsSummary>(`/api/news/${encodeURIComponent(id)}/summary`, { method: 'POST' });
}

export function syncNews(): Promise<NewsSyncStats> {
  return request<NewsSyncStats>('/api/news/sync', { method: 'POST' });
}
