import React, { useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Check, CircleAlert, Copy, Languages, Loader2, LogOut, Pencil, Receipt, RotateCw, Trash2 } from 'lucide-react';
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
import type { Bill, BillPayer, BillType, CreateBillData } from '@/types/bill';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { billsCopy, getInitialBillsLanguage, saveBillsLanguage, type BillsLanguage } from '@/i18n/bills';

function defaultBillMonth(): string {
  const now = new Date();
  if (now.getDate() <= 10) now.setMonth(now.getMonth() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatBillDate(value: string, language: BillsLanguage): string {
  const parts = value.slice(0, 7).split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  return new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1, 12));
}

function formatAmount(value: string, language: BillsLanguage): string {
  return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function payerName(payer: BillPayer | null): string {
  if (payer === 'HENRIQUE') return 'Henrique';
  if (payer === 'AMANDA') return 'Amanda';
  return '-';
}

function billResponsibilityName(responsibleBy: BillPayer | null, language: BillsLanguage): string {
  const copy = billsCopy[language];
  return responsibleBy ? `${copy.payerNames[responsibleBy]} ${copy.fullBill}` : copy.splitEqually;
}

function billTypeName(type: BillType, language: BillsLanguage): string {
  return billsCopy[language].typeNames[type];
}

interface BillMonthGroup {
  key: string;
  label: string;
  bills: Bill[];
  totalCents: number;
  paidByHenriqueCents: number;
  paidByAmandaCents: number;
  equalSplitPaidByHenriqueCents: number;
  equalSplitPaidByAmandaCents: number;
  fullReimbursementBalanceCents: number;
  paidUnassignedCents: number;
}

const duplicatePromptTypes = new Set<BillType>(['INTERNET', 'CONDOMINIO', 'ENERGY']);

function groupBillsByMonth(bills: Bill[], language: BillsLanguage): BillMonthGroup[] {
  const groups = new Map<string, BillMonthGroup>();
  for (const bill of bills) {
    const key = bill.billDate.slice(0, 7);
    let group = groups.get(key);
    if (!group) {
      const year = Number(key.slice(0, 4));
      const month = Number(key.slice(5, 7));
      group = {
        key,
        label: new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : 'en-US', { month: 'long', year: 'numeric' })
          .format(new Date(year, month - 1, 1, 12)),
        bills: [],
        totalCents: 0,
        paidByHenriqueCents: 0,
        paidByAmandaCents: 0,
        equalSplitPaidByHenriqueCents: 0,
        equalSplitPaidByAmandaCents: 0,
        fullReimbursementBalanceCents: 0,
        paidUnassignedCents: 0,
      };
      groups.set(key, group);
    }
    const amountCents = Math.round(Number(bill.amount) * 100);
    group.bills.push(bill);
    group.totalCents += amountCents;
    if (bill.isPaid && bill.paidBy === 'HENRIQUE') {
      group.paidByHenriqueCents += amountCents;
      if (bill.responsibleBy === null) group.equalSplitPaidByHenriqueCents += amountCents;
      else if (bill.responsibleBy === 'AMANDA') group.fullReimbursementBalanceCents += amountCents;
    } else if (bill.isPaid && bill.paidBy === 'AMANDA') {
      group.paidByAmandaCents += amountCents;
      if (bill.responsibleBy === null) group.equalSplitPaidByAmandaCents += amountCents;
      else if (bill.responsibleBy === 'HENRIQUE') group.fullReimbursementBalanceCents -= amountCents;
    } else if (bill.isPaid) group.paidUnassignedCents += amountCents;
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function formatCents(cents: number, language: BillsLanguage): string {
  return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function BillsControlPage(): React.JSX.Element {
  const { data: bills = [], isLoading, isError, refetch } = useBills();
  const { data: settlements = [], isLoading: settlementsLoading } = useBillSettlements();
  const createBill = useCreateBill();
  const updatePaid = useUpdateBillPaid();
  const removeBill = useDeleteBill();
  const setMonthSettlementPaid = useSetBillMonthSettlementPaid();
  const { logout, admin } = useAuth();
  const [language, setLanguage] = useState<BillsLanguage>(getInitialBillsLanguage);
  const copy = billsCopy[language];
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<BillType | ''>('');
  const [detail, setDetail] = useState('');
  const [billMonth, setBillMonth] = useState(defaultBillMonth);
  const [paidBy, setPaidBy] = useState<BillPayer | ''>('');
  const [responsibleBy, setResponsibleBy] = useState<BillPayer | ''>('');
  const [isPaid, setIsPaid] = useState(true);
  const [formError, setFormError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [billToEdit, setBillToEdit] = useState<Bill | null>(null);
  const [billToDelete, setBillToDelete] = useState<Bill | null>(null);
  const [duplicateBillConfirmation, setDuplicateBillConfirmation] = useState<CreateBillData | null>(null);
  const [replicatingBillId, setReplicatingBillId] = useState<string | null>(null);
  const hasFullBillResponsibilityMismatch = responsibleBy !== '' && (!paidBy || paidBy === responsibleBy);
  const addBillFormRef = useRef<HTMLElement | null>(null);
  const monthGroups = groupBillsByMonth(bills, language);
  const settlementPaidByMonth = new Map(settlements.map((settlement) => [settlement.month, settlement.settlementPaid]));

  function changeLanguage(nextLanguage: BillsLanguage): void {
    setLanguage(nextLanguage);
    saveBillsLanguage(nextLanguage);
  }

  function replicateBill(bill: Bill): void {
    setAmount(String(Number(bill.amount)));
    setType(bill.type);
    setDetail(bill.detail ?? '');
    setBillMonth(defaultBillMonth());
    setPaidBy(bill.paidBy ?? '');
    setResponsibleBy(bill.responsibleBy ?? '');
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
        toast.success(copy.billDeleted);
        setBillToDelete(null);
      },
      onError: () => toast.error(copy.deleteError),
    });
  }

  async function saveBill(data: CreateBillData): Promise<void> {
    try {
      await createBill.mutateAsync(data);
      setAmount('');
      setType('');
      setDetail('');
      setBillMonth(defaultBillMonth());
      setPaidBy('');
      setResponsibleBy('');
      setIsPaid(true);
      setReplicatingBillId(null);
    } catch {
      setFormError(copy.saveError);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError('');
    if (hasFullBillResponsibilityMismatch) {
      setFormError(copy.responsibilityError);
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError(language === 'pt' ? 'Informe um valor maior que zero.' : 'Enter an amount greater than zero.');
      return;
    }
    if (!type) {
      setFormError(language === 'pt' ? 'Selecione o tipo da conta.' : 'Select a bill type.');
      return;
    }
    const data: CreateBillData = { amount: parsedAmount, type, detail: type === 'OTHER' ? detail.trim() || null : null, billMonth, paidBy: paidBy || null, responsibleBy: responsibleBy || null, isPaid };
    const isDuplicate = bills.some((bill) => bill.type === type && bill.billDate.slice(0, 7) === billMonth);
    if (duplicatePromptTypes.has(type) && isDuplicate) {
      setDuplicateBillConfirmation(data);
      return;
    }
    await saveBill(data);
  }

  function confirmDuplicateAdd(): void {
    if (!duplicateBillConfirmation) return;
    const data = duplicateBillConfirmation;
    setDuplicateBillConfirmation(null);
    void saveBill(data);
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
    <div lang={language === 'pt' ? 'pt-BR' : 'en'} className="min-h-screen w-full max-w-full overflow-x-clip bg-background">
      <header className="bg-blue-600 text-white shadow-md">
        <div className="container mx-auto flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{copy.billsControl}</h1>
          <nav aria-label={language === 'pt' ? 'Menu principal' : 'Main menu'} className="flex flex-wrap items-center justify-end gap-3 text-sm sm:gap-5 sm:text-base">
            {admin?.permissions.includes('INVESTMENTS') && <a href="/" className="text-white/90 hover:text-white hover:underline">{copy.investments}</a>}
            <span aria-current="page" className="font-semibold underline underline-offset-4">{copy.billsControl}</span>
            {admin?.username && <span className="hidden sm:inline">{admin.username}</span>}
            <label title={`${copy.language}: ${language === 'pt' ? copy.portuguese : copy.english}`} className="relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-white/30 text-white hover:bg-blue-700 focus-within:ring-2 focus-within:ring-white">
              <Languages aria-hidden="true" className="h-4 w-4" />
              <select aria-label={copy.language} value={language} onChange={(event) => changeLanguage(event.target.value as BillsLanguage)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 focus-visible:outline-none">
                <option value="en" className="text-foreground">{copy.english}</option>
                <option value="pt" className="text-foreground">{copy.portuguese}</option>
              </select>
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 text-white hover:bg-white/15 hover:text-white sm:px-3"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              aria-label={copy.signOut}
            >
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              <span className="hidden sm:inline">{isLoggingOut ? copy.signingOut : copy.signOut}</span>
            </Button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {admin?.permissions.includes('INVESTMENTS') && (
          <a href="/" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> {copy.backToInvestments}
          </a>
        )}

        <section ref={addBillFormRef} className="mb-6 scroll-mt-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Receipt className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-semibold">{copy.addBill}</h2>
              <p className="text-sm text-muted-foreground">
                {replicatingBillId ? copy.copiedValues : copy.addDescription}
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void handleSubmit(event)} className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <label className="grid gap-1.5 text-sm font-medium">
              {copy.amount}
              <Input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {copy.type}
              <select value={type} onChange={(event) => setType(event.target.value as BillType | '')} required className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="" disabled>{copy.selectType}</option>
                <option value="INTERNET">{copy.internet}</option>
                <option value="CLEANING">{copy.cleaning}</option>
                <option value="CONDOMINIO">{copy.condo}</option>
                <option value="ENERGY">{copy.energy}</option>
                <option value="CARD">{copy.card}</option>
                <option value="OTHER">{copy.other}</option>
              </select>
            </label>
            {type === 'OTHER' && (
              <label className="grid gap-1.5 text-sm font-medium">
                {copy.details} <span className="font-normal text-muted-foreground">{copy.optional}</span>
                <Input type="text" maxLength={500} value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={copy.whatFor} />
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              {copy.month}
              <Input type="month" value={billMonth} onChange={(event) => setBillMonth(event.target.value)} required />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {copy.whoPaid} <span className="font-normal text-muted-foreground">{copy.optional}</span>
              <select value={paidBy} onChange={(event) => setPaidBy(event.target.value as BillPayer | '')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">{copy.notSpecified}</option>
                <option value="HENRIQUE">Henrique</option>
                <option value="AMANDA">Amanda</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {copy.responsibility}
              <select value={responsibleBy} onChange={(event) => setResponsibleBy(event.target.value as BillPayer | '')} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">{copy.splitEqually}</option>
                <option value="HENRIQUE">{copy.henriqueFull}</option>
                <option value="AMANDA">{copy.amandaFull}</option>
              </select>
            </label>
            {hasFullBillResponsibilityMismatch && (
              <p role="alert" className="text-sm text-amber-700 sm:col-span-2 lg:col-span-6">
                {copy.responsibilityError}
              </p>
            )}
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={isPaid} onChange={(event) => setIsPaid(event.target.checked)} className="h-4 w-4 accent-primary" />
              {copy.billIsPaid}
            </label>
            <Button type="submit" disabled={createBill.isPending || isLoading || hasFullBillResponsibilityMismatch} className="w-full">
              {createBill.isPending ? <Loader2 className="animate-spin" /> : <Check />}
              {copy.addBillButton}
            </Button>
          </form>
          {formError && <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-destructive"><CircleAlert className="h-4 w-4" />{formError}</p>}
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{copy.bills}</h2>
              <p className="text-sm text-muted-foreground">{bills.length} {bills.length === 1 ? copy.billRecorded : copy.billsRecorded}</p>
            </div>
            {isError && <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}><RotateCw className="h-4 w-4" /> {copy.retry}</Button>}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />{copy.loadingBills}</div>
          ) : isError ? (
            <p role="alert" className="py-8 text-center text-sm text-destructive">{copy.loadError}</p>
          ) : monthGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <Receipt className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="font-medium">{copy.noBills}</p>
              <p className="mt-1 text-sm text-muted-foreground">{copy.billsWillAppear}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {monthGroups.map((group) => {
                const splitDifferenceCents = group.equalSplitPaidByHenriqueCents - group.equalSplitPaidByAmandaCents;
                const settlementTwiceCents = splitDifferenceCents + group.fullReimbursementBalanceCents * 2;
                const settlementCents = Math.round(Math.abs(settlementTwiceCents) / 2);
                const settlementPaid = settlementPaidByMonth.get(group.key) ?? false;
                let settlementText = copy.noPaymentDue;
                if (settlementTwiceCents > 0) settlementText = language === 'pt'
                  ? `Amanda paga ${formatCents(settlementCents, language)} a Henrique pelo acerto das contas pagas.`
                  : `Amanda pays Henrique ${formatCents(settlementCents, language)} to balance paid bills.`;
                if (settlementTwiceCents < 0) settlementText = language === 'pt'
                  ? `Henrique paga ${formatCents(settlementCents, language)} a Amanda pelo acerto das contas pagas.`
                  : `Henrique pays Amanda ${formatCents(settlementCents, language)} to balance paid bills.`;

                return (
                  <section key={group.key} className="overflow-hidden rounded-xl border">
                    <div className="border-b bg-muted/50 p-4 sm:p-5">
                      <h3 className="text-lg font-semibold capitalize">{group.label}</h3>
                      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <SummaryAmount label={copy.monthlyTotal} value={formatCents(group.totalCents, language)} />
                        <SummaryAmount label={copy.paidByHenrique} value={formatCents(group.paidByHenriqueCents, language)} />
                        <SummaryAmount label={copy.paidByAmanda} value={formatCents(group.paidByAmandaCents, language)} />
                        <div className="rounded-lg border bg-card p-3">
                          <p className="text-xs text-muted-foreground">{copy.settlement}</p>
                          <p className="mt-1 text-sm font-semibold">{settlementText}</p>
                          {settlementTwiceCents !== 0 && (
                            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                aria-label={`${group.label} ${copy.settlementPaid.toLowerCase()}`}
                                checked={settlementPaid}
                                disabled={settlementsLoading || setMonthSettlementPaid.isPending}
                                onChange={(event) => setMonthSettlementPaid.mutate(
                                  { month: group.key, settlementPaid: event.target.checked },
                                  { onError: () => toast.error(copy.settlementError) },
                                )}
                                className="h-4 w-4 accent-primary"
                              />
                              {copy.settlementPaid}
                            </label>
                          )}
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">{copy.settlementDescription}</p>
                      {group.paidUnassignedCents > 0 && (
                        <p className="mt-1 text-xs text-amber-700">{formatCents(group.paidUnassignedCents, language)} {copy.payerMissing}</p>
                      )}
                    </div>
                    <div className="grid gap-3 p-3 md:hidden">
                      {group.bills.map((bill) => (
                        <article key={bill.id} className="min-w-0 rounded-lg border p-4">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0"><p className="text-lg font-semibold">{formatAmount(bill.amount, language)}</p><p className="mt-1 text-sm text-muted-foreground">{formatBillDate(bill.billDate, language)}</p></div>
                            <PaidToggle billId={bill.id} isPaid={bill.isPaid} pending={updatePaid.isPending} onChange={(next) => updatePaid.mutate({ id: bill.id, isPaid: next })} copy={copy} />
                          </div>
                          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                            <p><span className="text-muted-foreground">{copy.typeLabel}</span> {billTypeName(bill.type, language)}</p>
                            <p><span className="text-muted-foreground">{copy.paidByLabel}</span> {payerName(bill.paidBy)}</p>
                            <p><span className="text-muted-foreground">{copy.responsibilityLabel}</span> {billResponsibilityName(bill.responsibleBy, language)}</p>
                          </div>
                          {bill.detail && <p className="mt-1 break-words text-sm"><span className="text-muted-foreground">{copy.detailsLabel}</span> {bill.detail}</p>}
                          <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
                            <Button type="button" size="sm" variant="outline" className="w-full min-w-0 flex-col gap-1 px-1 py-2 text-xs" onClick={() => replicateBill(bill)} aria-label={`${copy.replicate} ${formatAmount(bill.amount, language)}`}><Copy className="h-4 w-4" />{copy.replicate}</Button>
                            <Button type="button" size="sm" variant="outline" className="w-full min-w-0 flex-col gap-1 px-1 py-2 text-xs" onClick={() => setBillToEdit(bill)} aria-label={`${copy.edit} ${formatAmount(bill.amount, language)}`}><Pencil className="h-4 w-4" />{copy.edit}</Button>
                            <Button type="button" size="sm" variant="destructive" className="w-full min-w-0 flex-col gap-1 px-1 py-2 text-xs" onClick={() => setBillToDelete(bill)} aria-label={`${copy.delete} ${formatAmount(bill.amount, language)}`}><Trash2 className="h-4 w-4" />{copy.delete}</Button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead><tr className="border-b text-muted-foreground"><th className="px-3 py-3 font-medium">{copy.monthColumn}</th><th className="px-3 py-3 font-medium">{copy.amountColumn}</th><th className="px-3 py-3 font-medium">{copy.typeColumn}</th><th className="px-3 py-3 font-medium">{copy.paidByColumn}</th><th className="px-3 py-3 font-medium">{copy.responsibilityColumn}</th><th className="px-3 py-3 font-medium">{copy.statusColumn}</th><th className="px-3 py-3 font-medium">{copy.actionsColumn}</th></tr></thead>
                        <tbody>{group.bills.map((bill) => (
                          <tr key={bill.id} className="border-b last:border-0">
                            <td className="px-3 py-3">{formatBillDate(bill.billDate, language)}</td>
                            <td className="px-3 py-3 font-semibold">{formatAmount(bill.amount, language)}</td>
                            <td className="px-3 py-3">{billTypeName(bill.type, language)}{bill.detail && <span className="block text-xs text-muted-foreground">{bill.detail}</span>}</td>
                            <td className="px-3 py-3">{payerName(bill.paidBy)}</td>
                            <td className="px-3 py-3">{billResponsibilityName(bill.responsibleBy, language)}</td>
                            <td className="px-3 py-3"><PaidToggle billId={bill.id} isPaid={bill.isPaid} pending={updatePaid.isPending} onChange={(next) => updatePaid.mutate({ id: bill.id, isPaid: next })} copy={copy} /></td>
                            <td className="px-3 py-3"><div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => replicateBill(bill)} aria-label={`${copy.replicate} ${formatAmount(bill.amount, language)}`}><Copy /></Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setBillToEdit(bill)} aria-label={`${copy.edit} ${formatAmount(bill.amount, language)}`}><Pencil /></Button>
                              <Button type="button" size="sm" variant="destructive" onClick={() => setBillToDelete(bill)} aria-label={`${copy.delete} ${formatAmount(bill.amount, language)}`}><Trash2 /></Button>
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
      <EditBillDialog bill={billToEdit} open={billToEdit !== null} language={language} onOpenChange={(open) => { if (!open) setBillToEdit(null); }} />
      <AlertDialog open={duplicateBillConfirmation !== null} onOpenChange={(open) => { if (!open && !createBill.isPending) setDuplicateBillConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.duplicateTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicateBillConfirmation && copy.duplicateMessage(billTypeName(duplicateBillConfirmation.type, language), formatBillDate(`${duplicateBillConfirmation.billMonth}-01`, language))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createBill.isPending}>{copy.duplicateCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDuplicateAdd} disabled={createBill.isPending}>
              {createBill.isPending ? copy.adding : copy.addAnyway}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={billToDelete !== null} onOpenChange={(open) => { if (!open && !removeBill.isPending) setBillToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {billToDelete && copy.deleteDescription(formatAmount(billToDelete.amount, language), formatBillDate(billToDelete.billDate, language))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBill.isPending}>{copy.duplicateCancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={removeBill.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removeBill.isPending ? copy.deleting : copy.deleteBill}
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
  copy: (typeof billsCopy)[BillsLanguage];
}

function PaidToggle({ billId, isPaid, pending, onChange, copy }: PaidToggleProps): React.JSX.Element {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap">
      <input aria-label={`${copy.billsControl} ${billId} ${copy.paid.toLowerCase()}`} type="checkbox" checked={isPaid} disabled={pending} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-primary" />
      <span className={isPaid ? 'font-medium text-emerald-700' : 'text-muted-foreground'}>{isPaid ? copy.paid : copy.unpaid}</span>
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
