import React, { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/hooks/useComments';
import { useUpdateInvestmentSector } from '@/hooks/useInvestments';
import { INVESTMENT_SECTORS } from '@/lib/investment-sectors';
import type { CommentItem } from '@/types/comment';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats an ISO timestamp as dd/MM/yyyy HH:mm (pt-BR). */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sector editor ────────────────────────────────────────────────────────────

interface SectorEditorProps {
  investmentId: string;
  currentSector: string | null;
}

/**
 * Inline sector selector inside the comment modal.
 * Shows current sector as a dropdown; saves on change with a toast confirmation.
 */
function SectorEditor({ investmentId, currentSector }: SectorEditorProps): React.JSX.Element {
  const updateSector = useUpdateInvestmentSector();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const sector = e.target.value;
    if (!sector) return;
    updateSector.mutate(
      { id: investmentId, sector },
      {
        onSuccess: () => toast.success(`Sector updated to "${sector}"`),
        onError: (err: Error) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Sector:</span>
      <select
        className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        defaultValue={currentSector ?? ''}
        onChange={handleChange}
        disabled={updateSector.isPending}
        aria-label="Investment sector"
      >
        <option value="">— not set —</option>
        {INVESTMENT_SECTORS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Add comment form ─────────────────────────────────────────────────────────

interface AddCommentFormProps {
  investmentId: string;
}

/**
 * Textarea form for adding a new comment.
 * Clears after successful submission.
 */
function AddCommentForm({ investmentId }: AddCommentFormProps): React.JSX.Element {
  const [content, setContent] = useState('');
  const createComment = useCreateComment(investmentId);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    createComment.mutate(trimmed, {
      onSuccess: () => {
        setContent('');
        toast.success('Comment added');
      },
      onError: (err: Error) => {
        toast.error(err.message);
      },
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2">
      <textarea
        className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        placeholder="Add a comment…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        aria-label="New comment"
        maxLength={2000}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{content.length}/2000</span>
        <Button type="submit" size="sm" disabled={!content.trim() || createComment.isPending}>
          {createComment.isPending ? 'Adding…' : 'Add Comment'}
        </Button>
      </div>
    </form>
  );
}

// ─── Single comment row ───────────────────────────────────────────────────────

interface CommentRowProps {
  comment: CommentItem;
  investmentId: string;
}

/**
 * Displays a single comment with edit and delete actions.
 * Clicking the pencil switches to an inline textarea editor.
 */
function CommentRow({ comment, investmentId }: CommentRowProps): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const updateComment = useUpdateComment(investmentId);
  const deleteComment = useDeleteComment(investmentId);

  function handleSave(): void {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    updateComment.mutate(
      { commentId: comment.id, content: trimmed },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success('Comment updated');
        },
        onError: (err: Error) => {
          toast.error(err.message);
        },
      },
    );
  }

  function handleDelete(): void {
    deleteComment.mutate(comment.id, {
      onSuccess: () => {
        toast.success('Comment deleted');
      },
      onError: (err: Error) => {
        toast.error(err.message);
      },
    });
  }

  function handleCancelEdit(): void {
    setEditContent(comment.content);
    setIsEditing(false);
  }

  return (
    <div className="grid gap-1.5 rounded-md border bg-muted/30 px-3 py-2.5">
      {isEditing ? (
        <>
          <textarea
            className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            aria-label="Edit comment"
            maxLength={2000}
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={!editContent.trim() || updateComment.isPending}
              aria-label="Save comment"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              aria-label="Cancel edit"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {formatDateTime(comment.createdAt)}
              {comment.updatedAt !== comment.createdAt && (
                <span className="ml-1 italic">(edited)</span>
              )}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={() => setIsEditing(true)}
                aria-label="Edit comment"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteComment.isPending}
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Comment list ─────────────────────────────────────────────────────────────

interface CommentListProps {
  investmentId: string;
}

function CommentList({ investmentId }: CommentListProps): React.JSX.Element {
  const { data: comments, isLoading, isError, error } = useComments(investmentId);

  if (isLoading) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">Loading comments…</p>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-center text-sm text-destructive" role="alert">
        Could not load comments: {error.message}
      </p>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">No comments yet.</p>
    );
  }

  return (
    <div className="grid gap-2">
      {comments.map((comment: CommentItem) => (
        <CommentRow key={comment.id} comment={comment} investmentId={investmentId} />
      ))}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface CommentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investmentId: string | null;
  ticker: string | null;
  sector: string | null;
}

/**
 * Modal for adding, editing, and deleting comments on a specific investment.
 *
 * - Top: textarea form to add a new comment
 * - Bottom: list of all comments, newest first, each with edit/delete controls
 *
 * Renders null when no investment is selected.
 *
 * @example
 * <CommentModal
 *   open={commentModalOpen}
 *   onOpenChange={setCommentModalOpen}
 *   investmentId={selectedInvestmentId}
 *   ticker={selectedTicker}
 * />
 */
export function CommentModal({
  open,
  onOpenChange,
  investmentId,
  ticker,
  sector,
}: CommentModalProps): React.JSX.Element | null {
  if (!investmentId || !ticker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Comments — {ticker}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Sector editor — inline, saves immediately on change */}
          <SectorEditor investmentId={investmentId} currentSector={sector} />

          <AddCommentForm investmentId={investmentId} />

          <div className="grid gap-2">
            <h3 className="text-sm font-semibold">All Comments</h3>
            <CommentList investmentId={investmentId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
