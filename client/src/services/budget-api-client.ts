import { request } from './api-client';
import type { Budget, BudgetItem, BudgetUser, BudgetWithItems, CreateBudgetItemData } from '../types/budget';

export function fetchBudgetUsers(): Promise<BudgetUser[]> {
  return request<BudgetUser[]>('/api/budgets/users');
}

export function fetchBudgets(): Promise<Budget[]> {
  return request<Budget[]>('/api/budgets');
}

export function createBudget(name: string): Promise<Budget> {
  return request<Budget>('/api/budgets', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateBudgetName(budgetId: string, name: string): Promise<Budget> {
  return request<Budget>(`/api/budgets/${encodeURIComponent(budgetId)}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function deleteBudget(budgetId: string): Promise<void> {
  return request<void>(`/api/budgets/${encodeURIComponent(budgetId)}`, { method: 'DELETE' });
}

export function fetchBudget(id: string): Promise<BudgetWithItems> {
  return request<BudgetWithItems>(`/api/budgets/${encodeURIComponent(id)}`);
}

export function createBudgetItem(budgetId: string, data: CreateBudgetItemData): Promise<BudgetItem> {
  return request<BudgetItem>(`/api/budgets/${encodeURIComponent(budgetId)}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateBudgetItem(budgetId: string, itemId: string, data: CreateBudgetItemData): Promise<BudgetItem> {
  return request<BudgetItem>(`/api/budgets/${encodeURIComponent(budgetId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteBudgetItem(budgetId: string, itemId: string): Promise<void> {
  return request<void>(`/api/budgets/${encodeURIComponent(budgetId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}
