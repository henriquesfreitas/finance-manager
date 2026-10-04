import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBill,
  deleteBill,
  editBill,
  fetchBillSettlements,
  fetchBills,
  setBillMonthSettlementPaid,
  updateBillPaid,
} from '../services/bill-api-client';
import type { CreateBillData } from '../types/bill';

export const BILLS_QUERY_KEY = ['bills'] as const;
export const BILL_SETTLEMENTS_QUERY_KEY = ['bills', 'settlements'] as const;

export function useBills() {
  return useQuery({ queryKey: BILLS_QUERY_KEY, queryFn: fetchBills });
}

export function useBillSettlements() {
  return useQuery({ queryKey: BILL_SETTLEMENTS_QUERY_KEY, queryFn: fetchBillSettlements });
}

export function useSetBillMonthSettlementPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, settlementPaid }: { month: string; settlementPaid: boolean }) =>
      setBillMonthSettlementPaid(month, settlementPaid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BILL_SETTLEMENTS_QUERY_KEY }),
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBillData) => createBill(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: BILL_SETTLEMENTS_QUERY_KEY });
    },
  });
}

export function useEditBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateBillData }) => editBill(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: BILL_SETTLEMENTS_QUERY_KEY });
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBill(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: BILL_SETTLEMENTS_QUERY_KEY });
    },
  });
}

export function useUpdateBillPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPaid }: { id: string; isPaid: boolean }) => updateBillPaid(id, isPaid),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: BILL_SETTLEMENTS_QUERY_KEY });
    },
  });
}
