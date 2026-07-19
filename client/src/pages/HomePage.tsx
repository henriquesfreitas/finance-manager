import React, { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddInvestmentForm } from '@/components/AddInvestmentForm';
import { InvestmentTable } from '@/components/InvestmentTable';
import { OrderModal } from '@/components/OrderModal';
import { ArchiveConfirmDialog } from '@/components/ArchiveConfirmDialog';
import { ArchiveSection } from '@/components/ArchiveSection';
import { AllOrdersSection } from '@/components/AllOrdersSection';
import { CommentModal } from '@/components/CommentModal';
import { useActiveInvestments } from '@/hooks/useInvestments';
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

  // ── Order modal state ────────────────────────────────────────────────────────
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<InvestmentListItem | null>(null);

  // ── Comment modal state ──────────────────────────────────────────────────────
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentInvestmentId, setCommentInvestmentId] = useState<string | null>(null);
  const [commentTicker, setCommentTicker] = useState<string | null>(null);
  const [commentSector, setCommentSector] = useState<string | null>(null);

  // ── Archive dialog state ─────────────────────────────────────────────────────
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivingInvestment, setArchivingInvestment] = useState<InvestmentListItem | null>(null);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleAddOrder(investment: InvestmentListItem): void {
    setSelectedInvestment(investment);
    setOrderModalOpen(true);
  }

  function handleTickerClick(id: string, ticker: string, sector: string | null): void {
    setCommentInvestmentId(id);
    setCommentTicker(ticker);
    setCommentSector(sector);
    setCommentModalOpen(true);
  }

  function handleCommentModalOpenChange(open: boolean): void {
    setCommentModalOpen(open);
    if (!open) {
      setCommentInvestmentId(null);
      setCommentTicker(null);
      setCommentSector(null);
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
    <div className="container mx-auto px-4 py-8">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Finance Investment Manager</h1>
        <AddInvestmentForm />
      </div>

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
      <InvestmentTable
        investments={investments}
        isLoading={isLoading}
        onAddOrder={handleAddOrder}
        onArchive={handleArchiveClick}
        onTickerClick={handleTickerClick}
      />

      {/* ── All orders history ───────────────────────────────────────────────── */}
      <div className="mt-8">
        <AllOrdersSection />
      </div>

      {/* ── Archive section ──────────────────────────────────────────────────── */}
      <div className="mt-8">
        <ArchiveSection onTickerClick={handleTickerClick} />
      </div>

      {/* ── Comment modal ─────────────────────────────────────────────────────── */}
      <CommentModal
        open={commentModalOpen}
        onOpenChange={handleCommentModalOpenChange}
        investmentId={commentInvestmentId}
        ticker={commentTicker}
        sector={commentSector}
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
    </div>
  );
}
