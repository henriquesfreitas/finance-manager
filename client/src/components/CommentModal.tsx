import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, Check, X, ChevronDown, ChevronRight, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment, useLatestCommentDates } from '@/hooks/useComments';
import { useOrders } from '@/hooks/useOrders';
import type { OrderListItem } from '@/types/order';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUpdateInvestmentRecommendation, useUpdateInvestmentSector } from '@/hooks/useInvestments';
import { INVESTMENT_SECTORS } from '@/lib/investment-sectors';
import { getRecommendationColorClass } from '@/lib/recommendation';
import type { CommentItem } from '@/types/comment';
import type { ArchivedInvestmentItem, InvestmentListItem } from '@/types/investment';
import {
  calculateCurrentTotal,
  calculatePortfolioWeight,
  calculateProfit,
  calculateTotalInvested,
  calculateTotalVariation,
} from '@/lib/investment-calculator';
import { formatQuantity } from '@/lib/utils';
import { sanitizeCommentHtml } from '@/lib/sanitize-comment-html';

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

interface RecommendationEditorProps {
  investmentId: string;
  recommendation: number | null;
}

/** Saves a 1–5 ticker recommendation and lets the table refresh its color. */
function RecommendationEditor({ investmentId, recommendation }: RecommendationEditorProps): React.JSX.Element {
  const updateRecommendation = useUpdateInvestmentRecommendation();
  const [selected, setSelected] = useState(recommendation?.toString() ?? '');

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    const nextRecommendation = value ? Number(value) : null;
    const previous = selected;
    setSelected(value);
    updateRecommendation.mutate(
      { id: investmentId, recommendation: nextRecommendation },
      {
        onSuccess: () => toast.success(nextRecommendation === null
          ? 'Ticker recommendation cleared'
          : `Ticker recommendation set to ${nextRecommendation}/5`),
        onError: (err: Error) => {
          setSelected(previous);
          toast.error(err.message);
        },
      },
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="ticker-recommendation" className="text-sm text-muted-foreground">Recommendation:</label>
      <select
        id="ticker-recommendation"
        className={`h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${getRecommendationColorClass(selected ? Number(selected) : null)}`}
        value={selected}
        onChange={handleChange}
        disabled={updateRecommendation.isPending}
        aria-label="Ticker recommendation"
      >
        <option value="">— not set —</option>
        <option value="1">1 — Lowest</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5 — Best</option>
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
        <span className="text-xs text-muted-foreground">HTML and pasted tables supported · {content.length}/2000</span>
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
            placeholder="HTML formatting supported"
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
          <div
            className="overflow-x-auto whitespace-pre-wrap text-sm [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(comment.content) }}
          />
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
  recommendation: number | null;
  investment?: InvestmentListItem | ArchivedInvestmentItem | null;
  activeInvestments?: InvestmentListItem[];
  onOpenOrders?: (investmentId: string) => void;
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
  recommendation,
  investment = null,
  activeInvestments = [],
  onOpenOrders,
}: CommentModalProps): React.JSX.Element | null {
  const [showInvestmentDetails, setShowInvestmentDetails] = useState(false);
  useEffect(() => {
    setShowInvestmentDetails(false);
  }, [open, investmentId]);

  if (!investmentId || !ticker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader className="flex-row items-center justify-between space-y-0 pr-8">
          <DialogTitle>{ticker}</DialogTitle>
          {onOpenOrders && activeInvestments.some((item) => item.id === investmentId) && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto shrink-0 px-0"
              onClick={() => onOpenOrders(investmentId)}
            >
              <ListOrdered className="mr-1.5 h-4 w-4" />
              Open orders
            </Button>
          )}
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <TickerOrderHistory key={`${investmentId}-${open}`} investmentId={investmentId} ticker={ticker} />
          {investment && (
            <section className="rounded-lg border">
              <Button
                type="button"
                variant="ghost"
                className="flex w-full justify-between px-3 py-3 text-left"
                aria-expanded={showInvestmentDetails}
                onClick={() => setShowInvestmentDetails((visible) => !visible)}
              >
                <span className="font-semibold">Investment Details</span>
                {showInvestmentDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
              {showInvestmentDetails && (
                <TickerInvestmentDetails
                  investment={investment}
                  activeInvestments={activeInvestments}
                  investmentId={investmentId}
                  sector={sector}
                  recommendation={recommendation}
                />
              )}
            </section>
          )}

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

interface TickerInvestmentDetailsProps {
  investment: InvestmentListItem | ArchivedInvestmentItem;
  activeInvestments: InvestmentListItem[];
  investmentId: string;
  sector: string | null;
  recommendation: number | null;
}

function TickerInvestmentDetails({
  investment,
  activeInvestments,
  investmentId,
  sector,
  recommendation,
}: TickerInvestmentDetailsProps): React.JSX.Element {
  const { data: latestCommentDates } = useLatestCommentDates();
  const quantity = Number(investment.position.quantity);
  const averagePrice = Number(investment.position.averagePrice);
  const hasPosition = quantity > 0;
  const isArchived = investment.archivedAt !== null;
  const quote = 'quote' in investment ? investment.quote : null;
  const currentPrice = investment.type === 'TREASURY'
    ? investment.currentValue !== null ? Number(investment.currentValue) : null
    : quote?.currentPrice ?? null;
  const totalInvested = calculateTotalInvested(quantity, averagePrice);
  const currentTotal = calculateCurrentTotal(quantity, currentPrice);
  const profit = calculateProfit(currentTotal, totalInvested);
  const totalVariation = calculateTotalVariation(profit, totalInvested);
  const dailyVariation = investment.type === 'STOCK' && hasPosition
    ? quote?.dailyChangePercent ?? null
    : null;
  const targetSellPrice = investment.targetSellPrice !== null ? Number(investment.targetSellPrice) : null;
  const targetBuyPrice = investment.targetBuyPrice !== null ? Number(investment.targetBuyPrice) : null;
  const targetSellColor = currentPrice !== null && targetSellPrice !== null && currentPrice >= targetSellPrice
    ? 'text-green-600 dark:text-green-400'
    : '';
  const targetBuyColor = currentPrice !== null && targetBuyPrice !== null && currentPrice <= targetBuyPrice
    ? 'text-green-600 dark:text-green-400'
    : '';
  const portfolioCurrentTotal = activeInvestments.reduce((total, item) => {
    const itemQuantity = Number(item.position.quantity);
    const itemAveragePrice = Number(item.position.averagePrice);
    const itemPrice = item.type === 'TREASURY'
      ? item.currentValue !== null ? Number(item.currentValue) : null
      : item.quote?.currentPrice ?? null;
    return total + (
      calculateCurrentTotal(itemQuantity, itemPrice)
      ?? calculateTotalInvested(itemQuantity, itemAveragePrice)
    );
  }, 0);
  const portfolioWeight = isArchived
    ? null
    : calculatePortfolioWeight(currentTotal ?? totalInvested, portfolioCurrentTotal);
  const commentDate = latestCommentDates?.[investment.id];
  const formatCurrency = (value: number | null): string => value === null
    ? 'N/A'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatPercent = (value: number | null): string => value === null
    ? 'N/A'
    : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  return (
    <div className="grid gap-3 border-t px-3 py-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <DetailField label="Ticker" value={investment.ticker} />
        <DetailField label="Sector" value={sector ?? '—'} />
        <DetailField label="Quantity" value={hasPosition ? formatQuantity(quantity) : '—'} />
        <DetailField label="Average price" value={hasPosition && investment.type === 'STOCK' ? formatCurrency(averagePrice) : '—'} />
        <DetailField label="Price now" value={formatCurrency(currentPrice)} />
        <DetailField
          label="Daily variation"
          value={investment.type === 'STOCK' && hasPosition ? formatPercent(dailyVariation) : '—'}
          valueClassName={investment.type === 'STOCK' && hasPosition ? profitColorClass(dailyVariation) : 'text-muted-foreground'}
        />
        <DetailField label="Target sell" value={targetSellPrice !== null ? formatCurrency(targetSellPrice) : '—'} valueClassName={targetSellColor} />
        <DetailField label="Target buy" value={targetBuyPrice !== null ? formatCurrency(targetBuyPrice) : '—'} valueClassName={targetBuyColor} />
        <DetailField label="Target buy quantity" value={investment.targetBuyQuantity !== null ? formatQuantity(Number(investment.targetBuyQuantity)) : '—'} />
        <DetailField label="Total invested" value={hasPosition ? formatCurrency(totalInvested) : '—'} />
        <DetailField label="Current total" value={hasPosition ? formatCurrency(currentTotal) : '—'} />
        <DetailField label="Profit" value={hasPosition ? formatCurrency(profit) : '—'} valueClassName={hasPosition ? profitColorClass(profit) : 'text-muted-foreground'} />
        <DetailField label="Variation" value={hasPosition ? formatPercent(totalVariation) : '—'} valueClassName={hasPosition ? profitColorClass(totalVariation) : 'text-muted-foreground'} />
        <DetailField label="Portfolio %" value={hasPosition && portfolioWeight !== null ? `${portfolioWeight.toFixed(1)}%` : '—'} />
        <DetailField label="Comment date" value={commentDate ? new Date(commentDate).toLocaleDateString('pt-BR') : '—'} />
      </dl>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-muted/40 px-3 py-3">
        <SectorEditor investmentId={investmentId} currentSector={sector} />
        <RecommendationEditor
          key={investmentId}
          investmentId={investmentId}
          recommendation={recommendation}
        />
      </div>
    </div>
  );
}

function DetailField({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }): React.JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm font-medium ${valueClassName}`}>{value}</dd>
    </div>
  );
}

function profitColorClass(value: number | null): string {
  if (value === null) return 'text-muted-foreground';
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-foreground';
}

function TickerOrderHistory({ investmentId, ticker }: { investmentId: string; ticker: string }): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const { data: orders, isLoading, isError } = useOrders(investmentId, isExpanded);

  return (
    <section className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="flex w-full justify-between"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span>Order History — {ticker}</span>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>
      {isExpanded && (
        isLoading ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Loading orders…</p>
        ) : isError ? (
          <p className="py-3 text-center text-sm text-destructive" role="alert">Could not load orders.</p>
        ) : !orders?.length ? (
          <p className="py-3 text-center text-sm text-muted-foreground">No orders recorded yet.</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price (R$)</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right">Total (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.slice(0, showAllOrders ? orders.length : 5).map((order: OrderListItem) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.type}</TableCell>
                      <TableCell className="text-right">{Number(order.quantity).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{order.type === 'SPLIT' ? '—' : Number(order.price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{new Date(`${order.orderDate}T12:00:00`).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{order.type === 'SPLIT' ? '—' : (Number(order.quantity) * Number(order.price)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {orders.length > 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-center"
                onClick={() => setShowAllOrders((value) => !value)}
              >
                {showAllOrders ? 'Show less' : 'Show all orders'}
              </Button>
            )}
          </>
        )
      )}
    </section>
  );
}
