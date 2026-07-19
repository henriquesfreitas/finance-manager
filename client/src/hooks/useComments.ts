import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
} from '../services/comment-api-client';
import type { CommentItem } from '../types/comment';

function commentsKey(investmentId: string) {
  return ['comments', investmentId] as const;
}

/**
 * Fetches all comments for an investment, newest first.
 * staleTime: 0 ensures always-fresh data when the modal opens.
 */
export function useComments(investmentId: string): UseQueryResult<CommentItem[], Error> {
  return useQuery({
    queryKey: commentsKey(investmentId),
    queryFn: () => fetchComments(investmentId),
    staleTime: 0,
    enabled: !!investmentId,
  });
}

/**
 * Creates a new comment. Invalidates the comments list on success.
 */
export function useCreateComment(
  investmentId: string,
): UseMutationResult<CommentItem, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createComment(investmentId, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(investmentId) });
    },
  });
}

/**
 * Updates an existing comment. Invalidates the comments list on success.
 */
export function useUpdateComment(
  investmentId: string,
): UseMutationResult<CommentItem, Error, { commentId: string; content: string }> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      updateComment(investmentId, commentId, content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(investmentId) });
    },
  });
}

/**
 * Deletes a comment. Invalidates the comments list on success.
 */
export function useDeleteComment(
  investmentId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(investmentId, commentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: commentsKey(investmentId) });
    },
  });
}
