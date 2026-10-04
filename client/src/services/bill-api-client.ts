import { request } from './api-client';
import type { Bill, BillMonthSettlement, CreateBillData } from '../types/bill';

export function fetchBills(): Promise<Bill[]> {
  return request<Bill[]>('/api/bills');
}

export function createBill(data: CreateBillData): Promise<Bill> {
  return request<Bill>('/api/bills', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function editBill(id: string, data: CreateBillData): Promise<Bill> {
  return request<Bill>(`/api/bills/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteBill(id: string): Promise<void> {
  return request<void>(`/api/bills/${id}`, { method: 'DELETE' });
}

export function updateBillPaid(id: string, isPaid: boolean): Promise<Bill> {
  return request<Bill>(`/api/bills/${id}/paid`, {
    method: 'PATCH',
    body: JSON.stringify({ isPaid }),
  });
}

export function fetchBillSettlements(): Promise<BillMonthSettlement[]> {
  return request<BillMonthSettlement[]>('/api/bills/settlements');
}

export function setBillMonthSettlementPaid(month: string, settlementPaid: boolean): Promise<BillMonthSettlement> {
  return request<BillMonthSettlement>(`/api/bills/settlements/${month}`, {
    method: 'PATCH',
    body: JSON.stringify({ settlementPaid }),
  });
}
