import { request } from './api-client';
import type { CommentItem } from '../types/comment';

/**
 * Fetches all comments for an investment, newest first.
 *
 * GET /api/investments/:id/comments
 */
export function fetchComments(investmentId: string): Promise<CommentItem[]> {
  return request<CommentItem[]>(`/api/investments/${investmentId}/comments`);
}

/**
 * Creates a new comment for an investment.
 *
 * POST /api/investments/:id/comments
 */
export function createComment(investmentId: string, content: string): Promise<CommentItem> {
  return request<CommentItem>(`/api/investments/${investmentId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

/**
 * Updates the content of an existing comment.
 *
 * PUT /api/investments/:id/comments/:commentId
 */
export function updateComment(
  investmentId: string,
  commentId: string,
  content: string,
): Promise<CommentItem> {
  return request<CommentItem>(`/api/investments/${investmentId}/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

/**
 * Deletes a comment.
 *
 * DELETE /api/investments/:id/comments/:commentId
 */
export function deleteComment(investmentId: string, commentId: string): Promise<void> {
  return request<void>(`/api/investments/${investmentId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}
