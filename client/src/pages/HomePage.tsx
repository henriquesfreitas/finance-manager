import React, { useState } from 'react';
import { AlertCircle, RefreshCw, LogOut, Loader2, Menu, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddInvestmentForm } from '@/components/AddInvestmentForm';
import { InvestmentTable } from '@/components/InvestmentTable';
import { OrderModal } from '@/components/OrderModal';
import { ArchiveConfirmDialog } from '@/components/ArchiveConfirmDialog';
import { ArchiveSection } from '@/components/ArchiveSection';
import { AllOrdersSection } from '@/components/AllOrdersSection';
import { CommentModal } from '@/components/CommentModal';
import { PortfolioAllocationDialog } from '@/components/PortfolioAllocationDialog';
import { useActiveInvestments, useArchivedInvestments } from '@/hooks/useInvestments';
import { useAuth } from '@/contexts/auth-context';
import type { InvestmentListItem } from '@/types/investment';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Home page — single page of the app (v2).
 * Orchestrates all v2 components: investment registration, active portfolio table,
 * order modal, archive confirmation dialog, and archived investments section.
 *
 * State ownership:
 * - Order modal: which investment is selected + open/close
 * - Archive dialog: which investment is being archived + open/close
 *
 * @example <HomePage />
 */
export function HomePage(): React.JSX.Element {
  const { data: investments = [], isLoading, isError, refetch, pricesLoading } = useActiveInvestments();
  const { data: archivedInvestments = [] } = useArchivedInvestments();
  const { logout, admin } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);
  const hasPlannedBuys = investments.some((investment) => investment.targetBuyQuantity !== null
    && Number.isFinite(Number(investment.targetBuyQuantity))
    && Number(investment.targetBuyQuantity) > 0);
  const hasWatchlist = investments.some((investment) => Number(investment.position.quantity) === 0);

  async function handleLogout(): Promise<void> {
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  // ── Order modal state ────────────────────────────────────────────────────────
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<InvestmentListItem | null>(null);

  // ── Comment modal state ──────────────────────────────────────────────────────
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentInvestmentId, setCommentInvestmentId] = useState<string | null>(null);
  const [commentTicker, setCommentTicker] = useState<string | null>(null);
  const [commentSector, setCommentSector] = useState<string | null>(null);
  const [commentRecommendation, setCommentRecommendation] = useState<number | null>(null);
  const modalInvestment = investments.find((investment) => investment.id === commentInvestmentId)
    ?? archivedInvestments.find((investment) => investment.id === commentInvestmentId)
    ?? null;

  // ── Archive dialog state ─────────────────────────────────────────────────────
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingInvestment, setArchivingInvestment] = useState<InvestmentListItem | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleAddOrder(investment: InvestmentListItem): void {
    setSelectedInvestment(investment);
    setOrderModalOpen(true);
  }

  function handleTickerClick(id: string, ticker: string, sector: string | null, recommendation: number | null): void {
    setCommentInvestmentId(id);
    setCommentTicker(ticker);
    setCommentSector(sector);
    setCommentRecommendation(recommendation);
    setCommentModalOpen(true);
  }

  function handleOpenTickerOrders(investmentId: string): void {
    const investment = investments.find((item) => item.id === investmentId);
    if (!investment) return;

    setSelectedInvestment(investment);
    setOrderModalOpen(true);
    handleCommentModalOpenChange(false);
  }

  function handleOpenTickerModal(investment: InvestmentListItem): void {
    setCommentInvestmentId(investment.id);
    setCommentTicker(investment.ticker);
    setCommentSector(investment.sector);
    setCommentRecommendation(investment.recommendation);
    setCommentModalOpen(true);
    handleOrderModalOpenChange(false);
  }

  function handleCommentModalOpenChange(open: boolean): void {
    setCommentModalOpen(open);
    if (!open) {
      setCommentInvestmentId(null);
      setCommentTicker(null);
      setCommentSector(null);
      setCommentRecommendation(null);
    }
  }

  function handleArchiveClick(investment: InvestmentListItem): void {
    setArchivingInvestment(investment);
    setArchiveDialogOpen(true);
  }

  function handleOrderModalOpenChange(open: boolean): void {
    setOrderModalOpen(open);
    // Clear selected investment when modal closes so OrderModal returns null
    // and avoids a brief flash of stale content during the close animation
    if (!open) {
      setSelectedInvestment(null);
    }
  }

  function handleArchiveDialogOpenChange(open: boolean): void {
    setArchiveDialogOpen(open);
    if (!open) {
      setArchivingInvestment(null);
    }
  }

  function navigateToSection(sectionId: string): void {
    if (sectionId === 'watchlist') setWatchlistOpen(true);
    setFloatingMenuOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-background">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header id="top" className="app-header scroll-mt-0 bg-blue-600 text-white shadow-md">
        <div className="container mx-auto flex min-h-16 flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">Finance Investment Manager</h1>
          <TickerSearch
            investments={investments}
            onSelect={(investment) => handleTickerClick(
              investment.id,
              investment.ticker,
              investment.sector,
              investment.recommendation,
            )}
          />
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-5">
            <nav aria-label="Page menu" className="flex min-w-0 flex-1 gap-3 overflow-x-auto py-1 text-sm sm:flex-none sm:gap-4 sm:overflow-visible sm:py-0 sm:text-base lg:text-lg">
              {admin?.permissions.includes('BILLS_CONTROL') && <a href="/bills-control" className="shrink-0 text-white/90 hover:text-white hover:underline">Bills Control</a>}
              {hasPlannedBuys && <a href="#planned-buys" className="shrink-0 text-white/90 hover:text-white hover:underline">Planned Buys</a>}
              {hasWatchlist && <a href="#watchlist" onClick={() => setWatchlistOpen(true)} className="shrink-0 text-white/90 hover:text-white hover:underline">Watchlist</a>}
            </nav>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <PortfolioAllocationDialog investments={investments} />
              <ThemeToggle onHeader />
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 text-white hover:bg-white/15 hover:text-white sm:px-3"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                aria-label="Sign out"
              >
                {isLoggingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    {admin?.username && (
                      <span className="hidden sm:inline">{admin.username}</span>
                    )}
                    <span className="sr-only sm:not-sr-only sm:ml-1">Sign out</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <section className="mb-6 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <h2 className="mb-3 text-lg font-semibold">Add Investment</h2>
          <AddInvestmentForm />
        </section>

      {/* ── Error state (server/DB unreachable) ─────────────────────────────── */}
      {isError && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Unable to load investments. The server may be unavailable.</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => void refetch()}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        </div>
      )}

      {/* ── Active investments table ─────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-3 shadow-sm sm:p-5">
        <InvestmentTable
          investments={investments}
          isLoading={isLoading}
          pricesLoading={pricesLoading}
          onAddOrder={handleAddOrder}
          onArchive={handleArchiveClick}
          onTickerClick={handleTickerClick}
          watchlistOpen={watchlistOpen}
          onToggleWatchlist={() => setWatchlistOpen((open) => !open)}
        />
      </section>

      {/* ── All orders history ───────────────────────────────────────────────── */}
      <section className="mt-8 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <AllOrdersSection />
      </section>

      {/* ── Archive section ──────────────────────────────────────────────────── */}
      <section className="mt-8 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <ArchiveSection onTickerClick={handleTickerClick} />
      </section>

      {/* ── Comment modal ─────────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col items-end sm:bottom-6 sm:right-6"
        onKeyDown={(event) => {
          if (event.key === 'Escape') setFloatingMenuOpen(false);
        }}
      >
        {floatingMenuOpen && (
          <nav
            id="floating-page-navigation"
            aria-label="Page navigation menu"
            className="mb-3 grid min-w-44 gap-1 rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl"
          >
            <button
              type="button"
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => navigateToSection('top')}
            >
              Go to top
            </button>
            {hasPlannedBuys && (
              <button
                type="button"
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigateToSection('planned-buys')}
              >
                Planned Buys
              </button>
            )}
            {hasWatchlist && (
              <button
                type="button"
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigateToSection('watchlist')}
              >
                Watchlist
              </button>
            )}
          </nav>
        )}
        <Button
          type="button"
          size="icon"
          aria-label={floatingMenuOpen ? 'Close page navigation' : 'Open page navigation'}
          aria-haspopup="true"
          aria-expanded={floatingMenuOpen}
          aria-controls="floating-page-navigation"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setFloatingMenuOpen((open) => !open)}
        >
          {floatingMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      <CommentModal
        open={commentModalOpen}
        onOpenChange={handleCommentModalOpenChange}
        investmentId={commentInvestmentId}
        ticker={commentTicker}
        sector={commentSector}
        recommendation={commentRecommendation}
        investment={modalInvestment}
        activeInvestments={investments}
        onOpenOrders={handleOpenTickerOrders}
      />

      {/* ── Order modal ──────────────────────────────────────────────────────── */}
      <OrderModal
        open={orderModalOpen}
        onOpenChange={handleOrderModalOpenChange}
        investment={selectedInvestment}
        onOpenTicker={handleOpenTickerModal}
      />

      {/* ── Archive confirmation dialog ──────────────────────────────────────── */}
      <ArchiveConfirmDialog
        open={archiveDialogOpen}
        onOpenChange={handleArchiveDialogOpenChange}
        investment={archivingInvestment}
        onSuccess={() => setArchivingInvestment(null)}
      />
      </main>
    </div>
  );
}

interface TickerSearchProps {
  investments: InvestmentListItem[];
  onSelect: (investment: InvestmentListItem) => void;
}

function TickerSearch({ investments, onSelect }: TickerSearchProps): React.JSX.Element {
  const [searchText, setSearchText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const normalizedSearch = searchText.trim().toLocaleLowerCase();
  const results = normalizedSearch
    ? investments.filter((investment) => [
        investment.ticker,
        investment.sector ?? '',
        investment.treasuryProductName ?? '',
      ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch))).slice(0, 8)
    : [];

  function selectInvestment(investment: InvestmentListItem): void {
    onSelect(investment);
    setSearchText('');
    setIsOpen(false);
  }

  return (
    <div className="relative w-full sm:w-52 sm:shrink-0 lg:w-64">
      <label htmlFor="ticker-search" className="sr-only">Search tickers</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="ticker-search"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && normalizedSearch.length > 0}
          aria-controls="ticker-search-results"
          aria-label="Search tickers"
          autoComplete="off"
          placeholder="Search ticker or name"
          value={searchText}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setSearchText(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsOpen(false);
            if (event.key === 'Enter' && results[0]) selectInvestment(results[0]);
          }}
          className="h-10 w-full rounded-md border border-white/40 bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-white/70"
        />
      </div>
      {isOpen && normalizedSearch.length > 0 && (
        <div
          id="ticker-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {results.length > 0 ? results.map((investment) => (
            <button
              key={investment.id}
              type="button"
              role="option"
              aria-selected="false"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectInvestment(investment)}
              className="flex w-full flex-col rounded-sm px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
            >
              <span className="text-sm font-semibold">{investment.ticker}</span>
              {(investment.treasuryProductName || investment.sector) && (
                <span className="text-xs text-muted-foreground">
                  {investment.treasuryProductName ?? investment.sector}
                </span>
              )}
            </button>
          )) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matching tickers</p>
          )}
        </div>
      )}
    </div>
  );
}
