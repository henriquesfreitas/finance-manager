import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createPortfolioComment,
  deletePortfolioComment,
  fetchPortfolioComments,
  updatePortfolioComment,
} from '@/services/portfolio-comment-api-client';

const portfolioCommentsKey = ['portfolio-comments'] as const;

export function usePortfolioComments(enabled = true) {
  return useQuery({
    queryKey: portfolioCommentsKey,
    queryFn: fetchPortfolioComments,
    staleTime: 0,
    enabled,
  });
}

export function useCreatePortfolioComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPortfolioComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portfolioCommentsKey }),
  });
}

export function useUpdatePortfolioComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => updatePortfolioComment(id, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portfolioCommentsKey }),
  });
}

export function useDeletePortfolioComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePortfolioComment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portfolioCommentsKey }),
  });
}
