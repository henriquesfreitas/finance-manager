import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBudget,
  createBudgetItem,
  deleteBudgetItem,
  fetchBudget,
  fetchBudgetUsers,
  fetchBudgets,
  updateBudgetItem,
} from '../services/budget-api-client';
import type { CreateBudgetItemData } from '../types/budget';

export const BUDGETS_QUERY_KEY = ['budgets'] as const;

export function useBudgets() {
  return useQuery({ queryKey: BUDGETS_QUERY_KEY, queryFn: fetchBudgets });
}

export function useBudgetUsers(enabled: boolean) {
  return useQuery({ queryKey: [...BUDGETS_QUERY_KEY, 'users'], queryFn: fetchBudgetUsers, enabled });
}

export function useBudget(id: string | null) {
  return useQuery({
    queryKey: [...BUDGETS_QUERY_KEY, id],
    queryFn: () => fetchBudget(id as string),
    enabled: id !== null,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createBudget(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY }),
  });
}

function useInvalidateBudget(id: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BUDGETS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: [...BUDGETS_QUERY_KEY, id] }),
    ]);
  };
}

export function useCreateBudgetItem(budgetId: string) {
  const invalidate = useInvalidateBudget(budgetId);
  return useMutation({
    mutationFn: (data: CreateBudgetItemData) => createBudgetItem(budgetId, data),
    onSuccess: invalidate,
  });
}

export function useUpdateBudgetItem(budgetId: string) {
  const invalidate = useInvalidateBudget(budgetId);
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: CreateBudgetItemData }) => updateBudgetItem(budgetId, itemId, data),
    onSuccess: invalidate,
  });
}

export function useDeleteBudgetItem(budgetId: string) {
  const invalidate = useInvalidateBudget(budgetId);
  return useMutation({
    mutationFn: (itemId: string) => deleteBudgetItem(budgetId, itemId),
    onSuccess: invalidate,
  });
}
