import React, { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useEditBill } from '@/hooks/useBills';
import type { Bill, BillPayer, BillType } from '@/types/bill';
import { billsCopy, type BillsLanguage } from '@/i18n/bills';

interface EditBillDialogProps {
  bill: Bill | null;
  open: boolean;
  language: BillsLanguage;
  onOpenChange: (open: boolean) => void;
}

export function EditBillDialog({ bill, open, language, onOpenChange }: EditBillDialogProps): React.JSX.Element {
  const copy = billsCopy[language];
  const editBill = useEditBill();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<BillType>('OTHER');
  const [detail, setDetail] = useState('');
  const [billMonth, setBillMonth] = useState('');
  const [paidBy, setPaidBy] = useState<BillPayer | ''>('');
  const [responsibleBy, setResponsibleBy] = useState<BillPayer | ''>('');
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState('');
  const hasFullBillResponsibilityMismatch = responsibleBy !== '' && (!paidBy || paidBy === responsibleBy);

  useEffect(() => {
    if (!open || !bill) return;
    setAmount(String(Number(bill.amount)));
    setType(bill.type);
    setDetail(bill.detail ?? '');
    setBillMonth(bill.billDate.slice(0, 7));
    setPaidBy(bill.paidBy ?? '');
    setResponsibleBy(bill.responsibleBy ?? '');
    setIsPaid(bill.isPaid);
    setError('');
  }, [open, bill]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!bill) return;
    if (hasFullBillResponsibilityMismatch) {
      setError(copy.responsibilityError);
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(language === 'pt' ? 'Informe um valor maior que zero.' : 'Enter an amount greater than zero.');
      return;
    }
    setError('');
    try {
      await editBill.mutateAsync({
        id: bill.id,
        data: { amount: parsedAmount, type, detail: type === 'OTHER' ? detail.trim() || null : null, billMonth, paidBy: paidBy || null, responsibleBy: responsibleBy || null, isPaid },
      });
      onOpenChange(false);
    } catch {
      setError(copy.updateError);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.editBill}</DialogTitle>
          <DialogDescription>{copy.editDescription}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">{copy.amount}
            <Input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{copy.type}
            <select value={type} onChange={(event) => setType(event.target.value as BillType)} required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="INTERNET">{copy.internet}</option>
              <option value="CLEANING">{copy.cleaning}</option>
              <option value="CONDOMINIO">{copy.condo}</option>
              <option value="ENERGY">{copy.energy}</option>
              <option value="CARD">{copy.card}</option>
              <option value="OTHER">{copy.other}</option>
            </select>
          </label>
          {type === 'OTHER' && (
            <label className="grid gap-1.5 text-sm font-medium">{copy.details} <span className="font-normal text-muted-foreground">{copy.optional}</span>
              <Input type="text" maxLength={500} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={copy.whatFor} />
            </label>
          )}
          <label className="grid gap-1.5 text-sm font-medium">{copy.month}
            <Input type="month" value={billMonth} onChange={(event) => setBillMonth(event.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{copy.whoPaid} <span className="font-normal text-muted-foreground">{copy.optional}</span>
            <select value={paidBy} onChange={(event) => setPaidBy(event.target.value as BillPayer | '')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">{copy.notSpecified}</option>
              <option value="HENRIQUE">Henrique</option>
              <option value="AMANDA">Amanda</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">{copy.responsibility}
            <select value={responsibleBy} onChange={(event) => setResponsibleBy(event.target.value as BillPayer | '')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">{copy.splitEqually}</option>
              <option value="HENRIQUE">{copy.henriqueFull}</option>
              <option value="AMANDA">{copy.amandaFull}</option>
            </select>
          </label>
          {hasFullBillResponsibilityMismatch && (
            <p role="alert" className="text-sm text-amber-700">
              {copy.responsibilityError}
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isPaid} onChange={(event) => setIsPaid(event.target.checked)} className="h-4 w-4 accent-primary" />
            {copy.billIsPaid}
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={editBill.isPending}>{copy.cancel}</Button>
            <Button type="submit" disabled={editBill.isPending || hasFullBillResponsibilityMismatch}>
              {editBill.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {copy.saveChanges}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
