export type BillPayer = 'HENRIQUE' | 'AMANDA';
export type BillType = 'INTERNET' | 'CLEANING' | 'CONDOMINIO' | 'ENERGY' | 'OTHER';

export interface Bill {
  id: string;
  amount: string;
  type: BillType;
  billDate: string;
  paidBy: BillPayer | null;
  isPaid: boolean;
  createdAt: string;
}

export interface CreateBillData {
  amount: number;
  type: BillType;
  billDate: string;
  paidBy: BillPayer | null;
  isPaid: boolean;
}

export interface BillMonthSettlement {
  month: string;
  settlementPaid: boolean;
  updatedAt: string;
}
