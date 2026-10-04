import React, { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEditBill } from '@/hooks/useBills';
import type { Bill, BillPayer, BillType } from '@/types/bill';

interface EditBillDialogProps {
  bill: Bill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditBillDialog({ bill, open, onOpenChange }: EditBillDialogProps): React.JSX.Element {
  const editBill = useEditBill();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<BillType>('OTHER');
  const [billDate, setBillDate] = useState('');
  const [paidBy, setPaidBy] = useState<BillPayer | ''>('');
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !bill) return;
    setAmount(String(Number(bill.amount)));
    setType(bill.type);
    setBillDate(bill.billDate.slice(0, 10));
    setPaidBy(bill.paidBy ?? '');
    setIsPaid(bill.isPaid);
    setError('');
  }, [open, bill]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!bill) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setError('');
    try {
      await editBill.mutateAsync({
        id: bill.id,
        data: { amount: parsedAmount, type, billDate, paidBy: paidBy || null, isPaid },
      });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update this bill.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit bill</DialogTitle>
          <DialogDescription>Update the amount, date, payer, or payment status.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">Amount (R$)
            <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Type
            <select value={type} onChange={(event) => setType(event.target.value as BillType)} required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="INTERNET">Internet</option>
              <option value="CLEANING">Cleaning</option>
              <option value="CONDOMINIO">Condomínio</option>
              <option value="ENERGY">Energy</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Date
            <Input type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Who paid <span className="font-normal text-muted-foreground">(optional)</span>
            <select value={paidBy} onChange={(event) => setPaidBy(event.target.value as BillPayer | '')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Not specified</option>
              <option value="HENRIQUE">Henrique</option>
              <option value="AMANDA">Amanda</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isPaid} onChange={(event) => setIsPaid(event.target.checked)} className="h-4 w-4 accent-primary" />
            Bill is paid
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={editBill.isPending}>Cancel</Button>
            <Button type="submit" disabled={editBill.isPending}>
              {editBill.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
