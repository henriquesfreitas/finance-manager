import { request } from './api-client';
import type { PortfolioCommentItem } from '../types/portfolio-comment';

const endpoint = '/api/investments/plan-comments';

export function fetchPortfolioComments(): Promise<PortfolioCommentItem[]> {
  return request<PortfolioCommentItem[]>(endpoint);
}

export function createPortfolioComment(content: string): Promise<PortfolioCommentItem> {
  return request<PortfolioCommentItem>(endpoint, { method: 'POST', body: JSON.stringify({ content }) });
}

export function updatePortfolioComment(id: string, content: string): Promise<PortfolioCommentItem> {
  return request<PortfolioCommentItem>(`${endpoint}/${id}`, { method: 'PUT', body: JSON.stringify({ content }) });
}

export function deletePortfolioComment(id: string): Promise<void> {
  return request<void>(`${endpoint}/${id}`, { method: 'DELETE' });
}
