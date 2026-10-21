export interface Budget {
  id: string;
  name: string;
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  budgetId: string;
  value: string;
  itemDate: string;
  description: string | null;
  additionalInfo: string | null;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetWithItems extends Budget {
  items: BudgetItem[];
}

export interface CreateBudgetItemData {
  value: number;
  itemDate: string;
  description: string | null;
  additionalInfo: string | null;
  isPaid: boolean;
}
