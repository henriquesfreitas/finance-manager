import React from 'react';
import { toast } from 'sonner';
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
import { useArchiveInvestment } from '../hooks/useInvestments';
import type { InvestmentListItem } from '../types/investment';

interface ArchiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentListItem | null;
  onSuccess?: () => void;
}

/**
 * Confirmation dialog shown before archiving an investment.
 * Uses soft-delete — the investment and its full order history are preserved.
 *
 * @example
 * <ArchiveConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   investment={selectedInvestment}
 *   onSuccess={() => setSelectedInvestment(null)}
 * />
 */
export function ArchiveConfirmDialog({
  open,
  onOpenChange,
  investment,
  onSuccess,
}: ArchiveConfirmDialogProps): React.JSX.Element | null {
  const mutation = useArchiveInvestment();

  if (!investment) return null;

  const { ticker, id } = investment;

  function handleConfirm(): void {
    mutation.mutate(id, {
      onSuccess: () => {
        toast.success(`${ticker} has been archived`);
        onSuccess?.();
        onOpenChange(false);
      },
      onError: (error: Error) => {
        toast.error(error.message);
        // Keep dialog open so user can retry or cancel
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {ticker}?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{ticker}</strong> will be removed from your active portfolio. Your full order
            history will be preserved and you can view this investment in the archive section at any
            time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending ? 'Archiving…' : 'Archive'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
