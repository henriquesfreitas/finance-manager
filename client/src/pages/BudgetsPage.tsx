import React, { useEffect, useState, type FormEvent } from 'react';
import { Check, Languages, Loader2, LogOut, Pencil, Plus, Save, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/auth-context';
import {
  useBudget,
  useBudgetUsers,
  useBudgets,
  useCreateBudget,
  useCreateBudgetItem,
  useDeleteBudget,
  useDeleteBudgetItem,
  useUpdateBudgetItem,
  useUpdateBudgetName,
} from '@/hooks/useBudgets';
import type { BudgetItem, CreateBudgetItemData } from '@/types/budget';
import { toast } from 'sonner';

type BudgetLanguage = 'en' | 'pt';

const copy = {
  en: {
    budgets: 'Budgets', investments: 'Investments', bills: 'Bills Control', signOut: 'Sign out', language: 'Language',
    newBudget: 'New budget', budgetName: 'Budget name', createBudget: 'Create budget', creating: 'Creating...',
    yourBudgets: 'Your budgets', noBudgets: 'No budgets yet. Create one to get started.', open: 'Open', usersWithBudgets: 'Users with budgets', noUsersWithBudgets: 'No users have budgets yet.',
    addItem: 'Add an item', editItem: 'Edit item', value: 'Value (R$)', date: 'Date', description: 'Description (optional)',
    additionalInfo: 'Additional information (optional)', paid: 'Paid', unpaid: 'Unpaid', saveItem: 'Save item', addItemButton: 'Add item', saving: 'Saving...',
    cancel: 'Cancel', saveName: 'Save name', editBudgetName: 'Edit budget name', deleteBudget: 'Delete budget', total: 'Total', unpaidTotal: 'Total unpaid', paidTotal: 'Total paid', items: 'Items', noItems: 'No items in this budget yet.', edit: 'Edit', delete: 'Remove',
    loading: 'Loading...', retry: 'Retry', loadError: 'Unable to load budgets. Please try again.', saveError: 'Unable to save. Please try again.',
    itemCreated: 'Item added', itemUpdated: 'Item updated', itemDeleted: 'Item removed', budgetCreated: 'Budget created', budgetUpdated: 'Budget name updated', budgetDeleted: 'Budget deleted',
    dateLabel: (date: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`)),
  },
  pt: {
    budgets: 'Orçamentos', investments: 'Investimentos', bills: 'Controle de contas', signOut: 'Sair', language: 'Idioma',
    newBudget: 'Novo orçamento', budgetName: 'Nome do orçamento', createBudget: 'Criar orçamento', creating: 'Criando...',
    yourBudgets: 'Seus orçamentos', noBudgets: 'Nenhum orçamento ainda. Crie um para começar.', open: 'Abrir', usersWithBudgets: 'Usuários com orçamentos', noUsersWithBudgets: 'Nenhum usuário tem orçamentos ainda.',
    addItem: 'Adicionar item', editItem: 'Editar item', value: 'Valor (R$)', date: 'Data', description: 'Descrição (opcional)',
    additionalInfo: 'Informações adicionais (opcional)', paid: 'Pago', unpaid: 'Pendente', saveItem: 'Salvar item', addItemButton: 'Adicionar item', saving: 'Salvando...',
    cancel: 'Cancelar', total: 'Total', unpaidTotal: 'Total não pago', paidTotal: 'Total pago', items: 'Itens', noItems: 'Este orçamento ainda não tem itens.', edit: 'Editar', delete: 'Remover',
    loading: 'Carregando...', retry: 'Tentar novamente', loadError: 'Não foi possível carregar os orçamentos. Tente novamente.', saveError: 'Não foi possível salvar. Tente novamente.',
    itemCreated: 'Item adicionado', itemUpdated: 'Item atualizado', itemDeleted: 'Item removido', budgetCreated: 'Orçamento criado',
    saveName: 'Salvar nome', editBudgetName: 'Editar nome do orçamento', deleteBudget: 'Excluir orçamento',
    budgetUpdated: 'Nome do orçamento atualizado', budgetDeleted: 'Orçamento excluído',
    dateLabel: (date: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`)),
  },
} as const;

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function initialLanguage(): BudgetLanguage {
  try {
    const saved = window.localStorage.getItem('finance-manager:budgets-language');
    if (saved === 'en' || saved === 'pt') return saved;
  } catch {
    // Fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function formatCurrency(value: number, language: BudgetLanguage): string {
  return new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
    style: 'currency', currency: 'BRL',
  }).format(value);
}

function ItemForm({
  language,
  item,
  isPending,
  onSubmit,
  onCancel,
}: {
  language: BudgetLanguage;
  item: BudgetItem | null;
  isPending: boolean;
  onSubmit: (data: CreateBudgetItemData) => Promise<void>;
  onCancel: () => void;
}): React.JSX.Element {
  const strings = copy[language];
  const [value, setValue] = useState(item?.value ?? '');
  const [itemDate, setItemDate] = useState(item?.itemDate.slice(0, 10) ?? localToday());
  const [description, setDescription] = useState(item?.description ?? '');
  const [additionalInfo, setAdditionalInfo] = useState(item?.additionalInfo ?? '');
  const [isPaid, setIsPaid] = useState(item?.isPaid ?? true);

  useEffect(() => {
    setValue(item?.value ?? '');
    setItemDate(item?.itemDate.slice(0, 10) ?? localToday());
    setDescription(item?.description ?? '');
    setAdditionalInfo(item?.additionalInfo ?? '');
    setIsPaid(item?.isPaid ?? true);
  }, [item]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return;
    await onSubmit({
      value: parsedValue,
      itemDate,
      description: description.trim() || null,
      additionalInfo: additionalInfo.trim() || null,
      isPaid,
    });
    if (!item) {
      setValue('');
      setItemDate(localToday());
      setDescription('');
      setAdditionalInfo('');
      setIsPaid(true);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <h3 className="sm:col-span-2 lg:col-span-3 text-base font-semibold">{item ? strings.editItem : strings.addItem}</h3>
      <label className="grid gap-1.5 text-sm font-medium">{strings.value}
        <Input type="number" step="0.01" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">{strings.date}
        <Input type="date" value={itemDate} onChange={(event) => setItemDate(event.target.value)} required />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">{strings.description}
        <Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{strings.additionalInfo}
        <textarea value={additionalInfo} onChange={(event) => setAdditionalInfo(event.target.value)} maxLength={2000} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" />
      </label>
      <label className="flex items-center gap-2 self-center text-sm font-medium">
        <input type="checkbox" checked={isPaid} onChange={(event) => setIsPaid(event.target.checked)} className="h-4 w-4 accent-primary" />
        {strings.paid}
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          {isPending ? strings.saving : item ? strings.saveItem : strings.addItemButton}
        </Button>
        {item && <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>{strings.cancel}</Button>}
      </div>
    </form>
  );
}

export function BudgetsPage(): React.JSX.Element {
  const { admin, logout } = useAuth();
  const { data: budgets = [], isLoading, isError, refetch } = useBudgets();
  const isBudgetAdmin = admin?.permissions.includes('ADMIN') ?? false;
  const { data: budgetUsers = [], isLoading: usersLoading, isError: usersError, refetch: refetchUsers } = useBudgetUsers(isBudgetAdmin);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [budgetName, setBudgetName] = useState('');
  const [editingBudgetName, setEditingBudgetName] = useState(false);
  const [editedBudgetName, setEditedBudgetName] = useState('');
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [language, setLanguage] = useState<BudgetLanguage>(initialLanguage);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const strings = copy[language];
  const selectedUser = budgetUsers.find((user) => user.id === selectedUserId) ?? null;
  const visibleBudgets = isBudgetAdmin ? selectedUser?.budgets ?? [] : budgets;
  const selectedBudget = visibleBudgets.find((budget) => budget.id === selectedBudgetId) ?? null;
  const { data: budgetDetails, isLoading: itemsLoading, isError: itemsError } = useBudget(selectedBudgetId);
  const createBudgetMutation = useCreateBudget();
  const updateBudgetNameMutation = useUpdateBudgetName();
  const deleteBudgetMutation = useDeleteBudget();
  const createItemMutation = useCreateBudgetItem(selectedBudgetId ?? '');
  const updateItemMutation = useUpdateBudgetItem(selectedBudgetId ?? '');
  const deleteItemMutation = useDeleteBudgetItem(selectedBudgetId ?? '');
  const itemPending = createItemMutation.isPending || updateItemMutation.isPending;

  useEffect(() => {
    if (isBudgetAdmin) {
      if (selectedUserId === null && budgetUsers.length > 0) {
        setSelectedUserId(budgetUsers[0]!.id);
        setSelectedBudgetId(budgetUsers[0]!.budgets[0]?.id ?? null);
      } else if (selectedUserId && !budgetUsers.some((user) => user.id === selectedUserId)) {
        setSelectedUserId(null);
        setSelectedBudgetId(null);
      }
      return;
    }
    if (selectedBudgetId === null && budgets.length > 0) setSelectedBudgetId(budgets[0]!.id);
    if (selectedBudgetId && !budgets.some((budget) => budget.id === selectedBudgetId)) setSelectedBudgetId(null);
  }, [isBudgetAdmin, budgetUsers, selectedUserId, budgets, selectedBudgetId]);

  async function handleCreateBudget(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const budget = await createBudgetMutation.mutateAsync(budgetName.trim());
      setBudgetName('');
      if (isBudgetAdmin && admin) setSelectedUserId(admin.id);
      setSelectedBudgetId(budget.id);
      toast.success(strings.budgetCreated);
    } catch {
      toast.error(strings.saveError);
    }
  }

  async function handleBudgetNameSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedBudget) return;
    try {
      await updateBudgetNameMutation.mutateAsync({ budgetId: selectedBudget.id, name: editedBudgetName.trim() });
      setEditingBudgetName(false);
      toast.success(strings.budgetUpdated);
    } catch {
      toast.error(strings.saveError);
    }
  }

  async function handleDeleteBudget(): Promise<void> {
    if (!selectedBudget) return;
    try {
      await deleteBudgetMutation.mutateAsync(selectedBudget.id);
      setSelectedBudgetId(null);
      setEditingBudgetName(false);
      toast.success(strings.budgetDeleted);
    } catch {
      toast.error(strings.saveError);
    }
  }

  async function handleItemSubmit(data: CreateBudgetItemData): Promise<void> {
    if (!selectedBudgetId) return;
    try {
      if (editingItem) {
        await updateItemMutation.mutateAsync({ itemId: editingItem.id, data });
        setEditingItem(null);
        toast.success(strings.itemUpdated);
      } else {
        await createItemMutation.mutateAsync(data);
        toast.success(strings.itemCreated);
      }
    } catch {
      toast.error(strings.saveError);
    }
  }

  async function removeItem(itemId: string): Promise<void> {
    try {
      await deleteItemMutation.mutateAsync(itemId);
      if (editingItem?.id === itemId) setEditingItem(null);
      toast.success(strings.itemDeleted);
    } catch {
      toast.error(strings.saveError);
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

  function changeLanguage(next: BudgetLanguage): void {
    setLanguage(next);
    try {
      window.localStorage.setItem('finance-manager:budgets-language', next);
    } catch {
      // Keep the selected language in memory when storage is unavailable.
    }
  }

  const totals = (budgetDetails?.items ?? []).reduce((result, item) => {
    const value = Number(item.value);
    result.total += value;
    if (item.isPaid) result.paid += value;
    else result.unpaid += value;
    return result;
  }, { total: 0, paid: 0, unpaid: 0 });

  return (
    <div lang={language === 'pt' ? 'pt-BR' : 'en'} className="min-h-screen w-full overflow-x-clip bg-background">
      <header className="app-header bg-blue-600 text-white shadow-md">
        <div className="container mx-auto flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">Finance Investment Manager</h1>
          <nav aria-label={language === 'pt' ? 'Menu principal' : 'Main menu'} className="flex items-center gap-3 text-sm sm:gap-4 sm:text-base">
            {admin?.permissions.includes('INVESTMENTS') && <a href="/" className="text-white/90 hover:text-white hover:underline">{strings.investments}</a>}
            {admin?.permissions.includes('BILLS_CONTROL') && <a href="/bills-control" className="text-white/90 hover:text-white hover:underline">{strings.bills}</a>}
            <span aria-current="page" className="underline underline-offset-4">{strings.budgets}</span>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle onHeader />
            <label title={strings.language} className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-white/30 text-white hover:bg-blue-700">
              <Languages aria-hidden="true" className="h-4 w-4" />
              <select aria-label={strings.language} value={language} onChange={(event) => changeLanguage(event.target.value as BudgetLanguage)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
                <option value="en">English</option><option value="pt">Português (Brasil)</option>
              </select>
            </label>
            <Button variant="ghost" size="sm" className="px-2 text-white hover:bg-white/15 hover:text-white sm:px-3" onClick={() => void handleLogout()} disabled={isLoggingOut} aria-label={strings.signOut}>
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{admin?.username}</span><span className="sr-only sm:not-sr-only sm:ml-1">{strings.signOut}</span></>}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 px-4 py-6 sm:py-8">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Wallet className="h-5 w-5" /></span><h2 className="text-lg font-semibold">{strings.newBudget}</h2></div>
          <form onSubmit={(event) => void handleCreateBudget(event)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid flex-1 gap-1.5 text-sm font-medium">{strings.budgetName}
              <Input value={budgetName} onChange={(event) => setBudgetName(event.target.value)} maxLength={200} required />
            </label>
            <Button type="submit" disabled={createBudgetMutation.isPending}>
              {createBudgetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {createBudgetMutation.isPending ? strings.creating : strings.createBudget}
            </Button>
          </form>
        </section>

        {isBudgetAdmin && <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">{strings.usersWithBudgets}</h2>
          {usersLoading && <p role="status" className="text-sm text-muted-foreground">{strings.loading}</p>}
          {usersError && <div className="flex flex-wrap items-center gap-3 text-sm text-destructive"><span>{strings.loadError}</span><Button variant="outline" size="sm" onClick={() => void refetchUsers()}>{strings.retry}</Button></div>}
          {!usersLoading && !usersError && budgetUsers.length === 0 && <p className="text-sm text-muted-foreground">{strings.noUsersWithBudgets}</p>}
          {budgetUsers.length > 0 && <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{budgetUsers.map((user) => (
            <li key={user.id}><button type="button" aria-pressed={selectedUserId === user.id} onClick={() => { setSelectedUserId(user.id); setSelectedBudgetId(user.budgets[0]?.id ?? null); setEditingItem(null); setEditingBudgetName(false); }} className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent ${selectedUserId === user.id ? 'border-primary bg-accent' : ''}`}>
              <span className="font-medium">{user.username}</span><span className="text-sm text-muted-foreground">{user.budgets.length}</span>
            </button></li>
          ))}</ul>}
        </section>}

        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">{isBudgetAdmin ? `${selectedUser?.username ?? ''} — ${strings.budgets}` : strings.yourBudgets}</h2>
          {(isBudgetAdmin ? usersLoading : isLoading) && <p role="status" className="text-sm text-muted-foreground">{strings.loading}</p>}
          {(isBudgetAdmin ? usersError : isError) && <div className="flex flex-wrap items-center gap-3 text-sm text-destructive"><span>{strings.loadError}</span><Button variant="outline" size="sm" onClick={() => void (isBudgetAdmin ? refetchUsers() : refetch())}>{strings.retry}</Button></div>}
          {!(isBudgetAdmin ? usersLoading : isLoading) && !(isBudgetAdmin ? usersError : isError) && visibleBudgets.length === 0 && <p className="text-sm text-muted-foreground">{strings.noBudgets}</p>}
          {visibleBudgets.length > 0 && <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{visibleBudgets.map((budget) => (
            <li key={budget.id}>
              <button type="button" aria-pressed={selectedBudgetId === budget.id} onClick={() => { setSelectedBudgetId(budget.id); setEditingItem(null); setEditingBudgetName(false); }} className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent ${selectedBudgetId === budget.id ? 'border-primary bg-accent' : ''}`}>
                <span><span className="block font-medium">{budget.name}</span><span className="mt-1 block text-xs text-muted-foreground">{strings.dateLabel(budget.createdAt.slice(0, 10))}</span></span>
                <span className="text-sm text-primary">{strings.open}</span>
              </button>
            </li>
          ))}</ul>}
        </section>

        {selectedBudget && <section className="grid gap-5 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {editingBudgetName ? <form onSubmit={(event) => void handleBudgetNameSubmit(event)} className="flex min-w-0 flex-1 flex-wrap items-end gap-2">
              <label className="grid min-w-48 flex-1 gap-1.5 text-sm font-medium">{strings.budgetName}
                <Input value={editedBudgetName} onChange={(event) => setEditedBudgetName(event.target.value)} maxLength={200} required autoFocus />
              </label>
              <Button type="submit" size="sm" disabled={updateBudgetNameMutation.isPending}>
                {updateBudgetNameMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {strings.saveName}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingBudgetName(false)} disabled={updateBudgetNameMutation.isPending}>{strings.cancel}</Button>
            </form> : <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-xl font-semibold">{selectedBudget.name}</h2>
              <Button type="button" variant="ghost" size="icon" onClick={() => { setEditedBudgetName(selectedBudget.name); setEditingBudgetName(true); }} aria-label={strings.editBudgetName} title={strings.editBudgetName}>
                <Pencil className="h-4 w-4" />
              </Button>
              {budgetDetails && !itemsLoading && !itemsError && budgetDetails.items.length === 0 && <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeleteBudget()} disabled={deleteBudgetMutation.isPending}>
                {deleteBudgetMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {strings.deleteBudget}
              </Button>}
            </div>}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-6">
              <p className="text-sm text-muted-foreground">{strings.total}<span className="ml-2 text-lg font-semibold text-foreground">{formatCurrency(totals.total, language)}</span></p>
              <p className="text-sm text-muted-foreground">{strings.unpaidTotal}<span className="ml-2 font-medium text-foreground">{formatCurrency(totals.unpaid, language)}</span></p>
              <p className="text-sm text-muted-foreground">{strings.paidTotal}<span className="ml-2 font-medium text-foreground">{formatCurrency(totals.paid, language)}</span></p>
            </div>
          </div>
          {itemsLoading && <p role="status" className="text-sm text-muted-foreground">{strings.loading}</p>}
          {itemsError && <p role="alert" className="text-sm text-destructive">{strings.loadError}</p>}
          <ItemForm language={language} item={editingItem} isPending={itemPending} onSubmit={handleItemSubmit} onCancel={() => setEditingItem(null)} />
          <div className="grid gap-3">
            <h3 className="text-base font-semibold">{strings.items} ({budgetDetails?.items.length ?? 0})</h3>
            {!itemsLoading && budgetDetails?.items.length === 0 && <p className="text-sm text-muted-foreground">{strings.noItems}</p>}
            {budgetDetails?.items.map((item) => <article key={item.id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-semibold">{formatCurrency(Number(item.value), language)}</span><time dateTime={item.itemDate.slice(0, 10)} className="text-sm text-muted-foreground">{strings.dateLabel(item.itemDate.slice(0, 10))}</time><span className={`rounded-full px-2 py-0.5 text-xs ${item.isPaid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-muted text-muted-foreground'}`}>{item.isPaid ? strings.paid : strings.unpaid}</span></div>
                {item.description && <p className="mt-1 break-words text-sm">{item.description}</p>}
                {item.additionalInfo && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.additionalInfo}</p>}
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingItem(item)} aria-label={`${strings.edit}: ${item.description || formatCurrency(Number(item.value), language)}`}><Pencil className="mr-1.5 h-4 w-4" />{strings.edit}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void removeItem(item.id)} disabled={deleteItemMutation.isPending} aria-label={`${strings.delete}: ${item.description || formatCurrency(Number(item.value), language)}`}><Trash2 className="mr-1.5 h-4 w-4" />{strings.delete}</Button>
              </div>
            </article>)}
          </div>
        </section>}
      </main>
    </div>
  );
}
