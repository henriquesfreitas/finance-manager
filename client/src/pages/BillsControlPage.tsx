import React, { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, CircleAlert, Copy, Loader2, LogOut, Pencil, Receipt, RotateCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditBillDialog } from '@/components/EditBillDialog';
import {
  useBillSettlements,
  useBills,
  useCreateBill,
  useDeleteBill,
  useSetBillMonthSettlementPaid,
  useUpdateBillPaid,
} from '@/hooks/useBills';
import type { Bill, BillPayer, BillType } from '@/types/bill';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';

function todayAsLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBillDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatAmount(value: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function payerName(payer: BillPayer | null): string {
  if (payer === 'HENRIQUE') return 'Henrique';
  if (payer === 'AMANDA') return 'Amanda';
  return '—';
}

function billTypeName(type: BillType): string {
  const names: Record<BillType, string> = {
    INTERNET: 'Internet',
    CLEANING: 'Cleaning',
    CONDOMINIO: 'Condomínio',
    ENERGY: 'Energy',
    OTHER: 'Other',
  };
  return names[type];
}

interface BillMonthGroup {
  key: string;
  label: string;
  bills: Bill[];
  totalCents: number;
  paidByHenriqueCents: number;
  paidByAmandaCents: number;
  paidUnassignedCents: number;
}

function groupBillsByMonth(bills: Bill[]): BillMonthGroup[] {
  const groups = new Map<string, BillMonthGroup>();
  for (const bill of bills) {
    const key = bill.billDate.slice(0, 7);
    let group = groups.get(key);
    if (!group) {
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(5, 7));
      group = {
        key,
        label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
          .format(new Date(year, month - 1, 1, 12)),
        bills: [],
        totalCents: 0,
        paidByHenriqueCents: 0,
        paidByAmandaCents: 0,
        paidUnassignedCents: 0,
      };
      groups.set(key, group);
    }
    const amountCents = Math.round(Number(bill.amount) * 100);
    group.bills.push(bill);
    group.totalCents += amountCents;
    if (bill.isPaid && bill.paidBy === 'HENRIQUE') group.paidByHenriqueCents += amountCents;
    else if (bill.isPaid && bill.paidBy === 'AMANDA') group.paidByAmandaCents += amountCents;
    else if (bill.isPaid) group.paidUnassignedCents += amountCents;
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function BillsControlPage(): React.JSX.Element {
  const { data: bills = [], isLoading, isError, refetch } = useBills();
  const { data: settlements = [], isLoading: settlementsLoading } = useBillSettlements();
  const createBill = useCreateBill();
  const updatePaid = useUpdateBillPaid();
  const removeBill = useDeleteBill();
  const setMonthSettlementPaid = useSetBillMonthSettlementPaid();
  const { logout, admin } = useAuth();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<BillType | ''>('');
  const [billDate, setBillDate] = useState(todayAsLocalDate);
  const [paidBy, setPaidBy] = useState<BillPayer | ''>('');
  const [isPaid, setIsPaid] = useState(false);
  const [formError, setFormError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [replicatingBillId, setReplicatingBillId] = useState<string | null>(null);
  const addBillFormRef = useRef<HTMLElement | null>(null);
  const monthGroups = groupBillsByMonth(bills);
  const settlementPaidByMonth = new Map(settlements.map((settlement) => [settlement.month, settlement.settlementPaid]));

  function replicateBill(bill: Bill): void {
    setAmount(String(Number(bill.amount)));
    setType(bill.type);
    setBillDate(todayAsLocalDate());
    setPaidBy(bill.paidBy ?? '');
    setIsPaid(bill.isPaid);
    setFormError('');
    setReplicatingBillId(bill.id);
    requestAnimationFrame(() => addBillFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function confirmDelete(): void {
    if (!billToDelete) return;
    const deletingBill = billToDelete;
    removeBill.mutate(deletingBill.id, {
      onSuccess: () => {
        toast.success('Bill deleted');
        setBillToDelete(null);
      },
      onError: (error) => toast.error(error.message || 'Unable to delete this bill.'),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError('');
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter an amount greater than zero.');
      return;
    }
    try {
      if (!type) {
        setFormError('Select a bill type.');
        return;
      }
      await createBill.mutateAsync({ amount: parsedAmount, type, billDate, paidBy: paidBy || null, isPaid });
      setAmount('');
      setType('');
      setBillDate(todayAsLocalDate());
      setPaidBy('');
      setIsPaid(false);
      setReplicatingBillId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save this bill.');
    }
  }

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-background">
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Bills Control</h1>
          <nav aria-label="Main menu" className="flex items-center gap-3 text-sm sm:gap-5 sm:text-base">
            {admin?.permissions.includes('INVESTMENTS') && <a href="/" className="text-white/90 hover:text-white hover:underline">Investments</a>}
            <span aria-current="page" className="font-semibold underline underline-offset-4">Bills Control</span>
            {admin?.username && <span className="hidden sm:inline">{admin.username}</span>}
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-white hover:bg-white/15 hover:text-white sm:px-3"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              aria-label="Sign out"
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span>{isLoggingOut ? 'Signing out…' : 'Sign out'}</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {admin?.permissions.includes('INVESTMENTS') && (
          <a href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to Investments
          </a>
        )}

        <section ref={addBillFormRef} className="mb-6 scroll-mt-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Receipt className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-semibold">Add a bill</h2>
              <p className="text-sm text-muted-foreground">
                {replicatingBillId ? 'Bill values copied below. Review and edit them before adding.' : 'Record the amount, date, payer, and payment status.'}
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void handleSubmit(event)} className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <label className="grid gap-1.5 text-sm font-medium">
              Amount (R$)
              <Input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Type
              <select value={type} onChange={(event) => setType(event.target.value as BillType | '')} required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="" disabled>Select type</option>
                <option value="INTERNET">Internet</option>
                <option value="CLEANING">Cleaning</option>
                <option value="CONDOMINIO">Condomínio</option>
                <option value="ENERGY">Energy</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Date
              <Input type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} required />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Who paid <span className="font-normal text-muted-foreground">(optional)</span>
              <select value={paidBy} onChange={(event) => setPaidBy(event.target.value as BillPayer | '')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">Not specified</option>
                <option value="HENRIQUE">Henrique</option>
                <option value="AMANDA">Amanda</option>
              </select>
            </label>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={isPaid} onChange={(event) => setIsPaid(event.target.checked)} className="h-4 w-4 accent-primary" />
              Bill is paid
            </label>
            <Button type="submit" disabled={createBill.isPending} className="w-full">
              {createBill.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              Add bill
            </Button>
          </form>
          {formError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive"><CircleAlert className="h-4 w-4" />{formError}</p>}
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Bills</h2>
              <p className="text-sm text-muted-foreground">{bills.length} {bills.length === 1 ? 'bill recorded' : 'bills recorded'}</p>
            </div>
            {isError && <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}><RotateCw className="h-4 w-4" /> Retry</Button>}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading bills…</div>
          ) : isError ? (
            <p role="alert" className="py-8 text-center text-sm text-destructive">Unable to load bills. The server may be unavailable.</p>
          ) : monthGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <Receipt className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="font-medium">No bills yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Bills you add will appear here.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {monthGroups.map((group) => {
                const differenceCents = group.paidByHenriqueCents - group.paidByAmandaCents;
                const settlementCents = Math.round(Math.abs(differenceCents) / 2);
                const settlementPaid = settlementPaidByMonth.get(group.key) ?? false;
                let settlementText = 'Henrique and Amanda have paid the same amount.';
                if (differenceCents > 0) settlementText = `Amanda pays Henrique ${formatCents(settlementCents)} to balance paid bills.`;
                if (differenceCents < 0) settlementText = `Henrique pays Amanda ${formatCents(settlementCents)} to balance paid bills.`;

                return (
                  <section key={group.key} className="overflow-hidden rounded-xl border">
                    <div className="border-b bg-muted/50 p-4 sm:p-5">
                      <h3 className="text-lg font-semibold capitalize">{group.label}</h3>
                      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <SummaryAmount label="Monthly bill total" value={formatCents(group.totalCents)} />
                        <SummaryAmount label="Paid by Henrique" value={formatCents(group.paidByHenriqueCents)} />
                        <SummaryAmount label="Paid by Amanda" value={formatCents(group.paidByAmandaCents)} />
                        <div className="rounded-lg border bg-card p-3">
                          <p className="text-xs text-muted-foreground">Equal split of paid bills</p>
                          <p className="mt-1 text-sm font-semibold">{settlementText}</p>
                          {differenceCents !== 0 && (
                            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                aria-label={`${group.label} settlement paid`}
                                checked={settlementPaid}
                                disabled={settlementsLoading || setMonthSettlementPaid.isPending}
                                onChange={(event) => setMonthSettlementPaid.mutate(
                                  { month: group.key, settlementPaid: event.target.checked },
                                  { onError: (error) => toast.error(error.message || 'Unable to update settlement status.') },
                                )}
                                className="h-4 w-4 accent-primary"
                              />
                              Settlement paid
                            </label>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">Monthly total includes unpaid bills. The equal split compares only bills marked paid with a payer selected.</p>
                      {group.paidUnassignedCents > 0 && (
                        <p className="mt-1 text-xs text-amber-700">{formatCents(group.paidUnassignedCents)} in paid bills has no payer selected and is excluded from the equal split.</p>
                      )}
                    </div>
                    <div className="grid gap-3 p-3 md:hidden">
                      {group.bills.map((bill) => (
                        <article key={bill.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div><p className="text-lg font-semibold">{formatAmount(bill.amount)}</p><p className="mt-1 text-sm text-muted-foreground">{formatBillDate(bill.billDate)}</p></div>
                            <PaidToggle billId={bill.id} isPaid={bill.isPaid} pending={updatePaid.isPending} onChange={(next) => updatePaid.mutate({ id: bill.id, isPaid: next })} />
                          </div>
                          <p className="mt-3 text-sm"><span className="text-muted-foreground">Type:</span> {billTypeName(bill.type)}</p>
                          <p className="mt-1 text-sm"><span className="text-muted-foreground">Paid by:</span> {payerName(bill.paidBy)}</p>
                          <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                            <Button type="button" size="sm" variant="outline" onClick={() => replicateBill(bill)} aria-label={`Replicate bill ${formatAmount(bill.amount)}`}><Copy /> Replicate</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setBillToEdit(bill)} aria-label={`Edit bill ${formatAmount(bill.amount)}`}><Pencil /> Edit</Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => setBillToDelete(bill)} aria-label={`Delete bill ${formatAmount(bill.amount)}`}><Trash2 /> Delete</Button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead><tr className="border-b text-muted-foreground"><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Amount</th><th className="px-3 py-3 font-medium">Type</th><th className="px-3 py-3 font-medium">Paid by</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Actions</th></tr></thead>
                        <tbody>{group.bills.map((bill) => (
                          <tr key={bill.id} className="border-b last:border-0">
                            <td className="px-3 py-3">{formatBillDate(bill.billDate)}</td>
                            <td className="px-3 py-3 font-semibold">{formatAmount(bill.amount)}</td>
                            <td className="px-3 py-3">{billTypeName(bill.type)}</td>
                            <td className="px-3 py-3">{payerName(bill.paidBy)}</td>
                            <td className="px-3 py-3"><PaidToggle billId={bill.id} isPaid={bill.isPaid} pending={updatePaid.isPending} onChange={(next) => updatePaid.mutate({ id: bill.id, isPaid: next })} /></td>
                            <td className="px-3 py-3"><div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => replicateBill(bill)} aria-label={`Replicate bill ${formatAmount(bill.amount)}`}><Copy /></Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setBillToEdit(bill)} aria-label={`Edit bill ${formatAmount(bill.amount)}`}><Pencil /></Button>
                              <Button type="button" size="sm" variant="destructive" onClick={() => setBillToDelete(bill)} aria-label={`Delete bill ${formatAmount(bill.amount)}`}><Trash2 /></Button>
                            </div></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <EditBillDialog bill={billToEdit} open={billToEdit !== null} onOpenChange={(open) => { if (!open) setBillToEdit(null); }} />
      <AlertDialog open={billToDelete !== null} onOpenChange={(open) => { if (!open && !removeBill.isPending) setBillToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              {billToDelete && <>{formatAmount(billToDelete.amount)} from {formatBillDate(billToDelete.billDate)} will be permanently deleted.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBill.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={removeBill.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removeBill.isPending ? 'Deleting…' : 'Delete bill'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface PaidToggleProps {
  billId: string;
  isPaid: boolean;
  pending: boolean;
  onChange: (isPaid: boolean) => void;
}

function PaidToggle({ billId, isPaid, pending, onChange }: PaidToggleProps): React.JSX.Element {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap">
      <input aria-label={`Bill ${billId} paid`} type="checkbox" checked={isPaid} disabled={pending} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-primary" />
      <span className={isPaid ? 'font-medium text-emerald-700' : 'text-muted-foreground'}>{isPaid ? 'Paid' : 'Unpaid'}</span>
    </label>
  );
}

function SummaryAmount({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
