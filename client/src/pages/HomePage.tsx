import React, { useState } from 'react';
import { AlertCircle, RefreshCw, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddInvestmentForm } from '@/components/AddInvestmentForm';
import { InvestmentTable } from '@/components/InvestmentTable';
import { OrderModal } from '@/components/OrderModal';
import { ArchiveConfirmDialog } from '@/components/ArchiveConfirmDialog';
import { ArchiveSection } from '@/components/ArchiveSection';
import { AllOrdersSection } from '@/components/AllOrdersSection';
import { CommentModal } from '@/components/CommentModal';
import { PortfolioAllocationDialog } from '@/components/PortfolioAllocationDialog';
import { useActiveInvestments } from '@/hooks/useInvestments';
import { useAuth } from '@/contexts/auth-context';
import type { InvestmentListItem } from '@/types/investment';

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
  const { data: investments = [], isLoading, isError, refetch } = useActiveInvestments();
  const { logout, admin } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header id="top" className="scroll-mt-0 bg-blue-600 text-white shadow-md">
        <div className="container mx-auto flex min-h-16 flex-col items-stretch gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">Finance Investment Manager</h1>
          <nav aria-label="Page sections" className="-mx-1 flex gap-4 overflow-x-auto border-y border-white/20 py-2 text-sm sm:mx-0 sm:border-0 sm:py-0">
            {hasPlannedBuys && <a href="#planned-buys" className="shrink-0 text-white/90 hover:text-white hover:underline">Planned Buys</a>}
            {hasWatchlist && <a href="#watchlist" className="shrink-0 text-white/90 hover:text-white hover:underline">Watchlist</a>}
          </nav>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <PortfolioAllocationDialog investments={investments} />
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              aria-label="Sign out"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="mr-2 h-4 w-4" />
                  {admin?.username && (
                    <span className="hidden sm:inline">{admin.username}</span>
                  )}
                  <span className="sr-only sm:not-sr-only sm:ml-1">Sign out</span>
                </>
              )}
            </Button>
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
          onAddOrder={handleAddOrder}
          onArchive={handleArchiveClick}
          onTickerClick={handleTickerClick}
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
      <CommentModal
        open={commentModalOpen}
        onOpenChange={handleCommentModalOpenChange}
        investmentId={commentInvestmentId}
        ticker={commentTicker}
        sector={commentSector}
        recommendation={commentRecommendation}
      />

      {/* ── Order modal ──────────────────────────────────────────────────────── */}
      <OrderModal
        open={orderModalOpen}
        onOpenChange={handleOrderModalOpenChange}
        investment={selectedInvestment}
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
