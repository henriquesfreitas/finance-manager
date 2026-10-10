import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Check, X, ChevronDown, ChevronRight, ListOrdered, Info } from 'lucide-react';
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
import { useInvestmentPriceHistory, useUpdateInvestmentRecommendation, useUpdateInvestmentSector } from '@/hooks/useInvestments';
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
        maxLength={10000}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">HTML and pasted tables supported · {content.length}/10000</span>
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
            maxLength={10000}
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
      <DialogContent className="sm:max-w-[1100px]">
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
  const fundamentals = investment.type === 'STOCK' ? quote?.fundamentals : undefined;
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
      {investment.type === 'STOCK' && <PriceHistoryChart investmentId={investmentId} />}
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
        {investment.type === 'STOCK' && (
          <>
            <DetailField
              label="P/L"
              value={formatRatio(fundamentals?.pl)}
              help="Price-to-earnings (P/E) compares a share's price with its earnings per share. It roughly indicates how much investors pay for each R$1 of annual earnings. There is no universal healthy cutoff: compare companies in the same sector and the company's own history. Negative or near-zero earnings make this ratio misleading."
            />
            <DetailField
              label="P/VP"
              value={formatRatio(fundamentals?.pvp)}
              help="Price-to-book (P/B) compares market price per share with book value per share. Below 1x means the share trades below its reported book value, but this can reflect either an opportunity or concerns about the business. It is generally more useful for banks and asset-heavy companies; compare with sector peers."
            />
            <DetailField
              label="ROE"
              value={formatPercentValue(fundamentals?.roe)}
              valueClassName={getMetricColorClass('roe', fundamentals?.roe)}
              help="Return on equity (ROE) is net income divided by shareholders' equity. It measures profit generated for each R$1 of book equity. As a rough rule of thumb, sustained ROE above 15% is often considered strong; compare with similar companies, because leverage and one-off profits can inflate it."
            />
            <DetailField
              label="Dividend Yield"
              value={formatPercentValue(fundamentals?.dividendYield)}
            />
            <DetailField
              label="Dívida Líquida / EBITDA"
              value={formatRatio(fundamentals?.netDebtToEbitda)}
              valueClassName={getMetricColorClass('netDebtToEbitda', fundamentals?.netDebtToEbitda)}
              help="Net debt-to-EBITDA compares net debt with annual EBITDA. As a rough measure, it estimates how many years of unchanged EBITDA would equal net debt; it does not account for interest, taxes, capital spending, or cash-flow changes. Below 2x is generally considered comfortable; 2x–3.5x calls for attention; above 3.5x signals higher leverage. These are broad reference ranges, and banks and other financial companies are usually not comparable with this metric."
            />
          </>
        )}
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

function PriceHistoryChart({ investmentId }: { investmentId: string }): React.JSX.Element {
  const ranges = ['1D', '5D', '1M', '6M', 'YTD', '1Y', '5Y', 'Max'] as const;
  const [range, setRange] = useState<(typeof ranges)[number]>('1Y');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(760);
  const chartRef = useRef<SVGSVGElement | null>(null);
  const { data = [], isLoading, isError } = useInvestmentPriceHistory(investmentId, range);
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  const points = data.filter((point) => Number.isFinite(point.price));
  const height = 230;
  const plot = { left: 44, right: width - 12, top: 12, bottom: 196 };
  const prices = points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || Math.abs(max) * 0.05 || 1;
  const chartMin = min - span * 0.08;
  const chartMax = max + span * 0.08;
  const coordinates = points.map((point, index) => ({
    x: plot.left + (index / Math.max(points.length - 1, 1)) * (plot.right - plot.left),
    y: plot.bottom - ((point.price - chartMin) / (chartMax - chartMin)) * (plot.bottom - plot.top),
  }));
  const line = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = coordinates.length > 0
    ? `${line} L ${coordinates[coordinates.length - 1]!.x} ${plot.bottom} L ${coordinates[0]!.x} ${plot.bottom} Z`
    : '';
  const formatCurrency = (value: number): string => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (value: string): string => new Date(value).toLocaleDateString('pt-BR',
    range === '1D' || range === '5D' ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' });
  const selectedPoint = selectedIndex === null ? null : points[selectedIndex];
  const selectedCoordinate = selectedIndex === null ? null : coordinates[selectedIndex];
  const selectNearestPoint = (clientX: number, bounds: DOMRect): void => {
    if (points.length === 0 || bounds.width === 0) return;
    const chartX = ((clientX - bounds.left) / bounds.width) * width;
    const ratio = Math.min(1, Math.max(0, (chartX - plot.left) / (plot.right - plot.left)));
    setSelectedIndex(Math.round(ratio * (points.length - 1)));
  };
  const yTicks = Array.from({ length: 5 }, (_, index) => chartMin + ((chartMax - chartMin) * index) / 4);

  return (
    <section className="overflow-hidden rounded-lg bg-[#202228] text-white" aria-label="Price history">
      <div className="flex overflow-x-auto border-b border-white/10 px-2">
        {ranges.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => { setRange(item); setSelectedIndex(null); }}
            className={`relative min-w-12 flex-1 px-2 py-3 text-xs font-medium transition-colors hover:text-white ${range === item ? 'text-white' : 'text-slate-400'}`}
            aria-pressed={range === item}
          >
            {item}
            {range === item && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-400" />}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="py-12 text-center text-sm text-slate-400">Loading price history…</p>
      ) : isError ? (
        <p className="py-12 text-center text-sm text-slate-400">Could not load price history.</p>
      ) : points.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-400">No price history available.</p>
      ) : (
        <>
          <svg
            ref={chartRef}
            viewBox={`0 0 ${width} ${height}`}
            className="h-56 w-full touch-none"
            role="img"
            aria-label={`${range} price chart from ${formatDate(points[0]!.date)} to ${formatDate(points[points.length - 1]!.date)}`}
            onPointerMove={(event) => selectNearestPoint(event.clientX, event.currentTarget.getBoundingClientRect())}
            onPointerDown={(event) => selectNearestPoint(event.clientX, event.currentTarget.getBoundingClientRect())}
            onPointerLeave={(event) => { if (event.pointerType !== 'touch') setSelectedIndex(null); }}
          >
            <defs>
              <linearGradient id={`price-area-${investmentId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#78c995" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#78c995" stopOpacity="0" />
              </linearGradient>
            </defs>
            {yTicks.map((tick, index) => {
              const y = plot.bottom - (index / 4) * (plot.bottom - plot.top);
              return (
                <g key={tick}>
                  <line x1={plot.left} x2={plot.right} y1={y} y2={y} stroke="white" strokeOpacity="0.1" />
                  <text x="4" y={y + 4} fill="#a1a1aa" fontSize="12">{tick.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</text>
                </g>
              );
            })}
            <path d={area} fill={`url(#price-area-${investmentId})`} />
            <path d={line} fill="none" stroke="#78c995" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            {selectedCoordinate && selectedPoint && (
              <g pointerEvents="none">
                <line x1={selectedCoordinate.x} x2={selectedCoordinate.x} y1={plot.top} y2={plot.bottom} stroke="white" strokeOpacity="0.35" strokeDasharray="3 4" />
                <circle cx={selectedCoordinate.x} cy={selectedCoordinate.y} r="5" fill="#78c995" stroke="#202228" strokeWidth="2" />
                <g transform={`translate(${Math.min(width - 172, Math.max(plot.left, selectedCoordinate.x - 86))}, 16)`}>
                  <rect width="168" height="34" rx="4" fill="#15161a" fillOpacity="0.96" />
                  <text x="8" y="14" fill="white" fontSize="12" fontWeight="600">{formatCurrency(selectedPoint.price)}</text>
                  <text x="8" y="28" fill="#a1a1aa" fontSize="10">{formatDate(selectedPoint.date)}</text>
                </g>
              </g>
            )}
          </svg>
          {selectedPoint && <p className="sr-only" aria-live="polite">{formatCurrency(selectedPoint.price)} on {formatDate(selectedPoint.date)}</p>}
          <div className="flex justify-between px-12 pb-2 text-xs text-slate-400">
            <span>{new Date(points[0]!.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
            <span>{new Date(points[Math.floor(points.length / 2)]!.date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>
            <span>{new Date(points[points.length - 1]!.date).toLocaleDateString('pt-BR', { month: 'short' })}</span>
          </div>
        </>
      )}
    </section>
  );
}

function formatRatio(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function formatPercentValue(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

type FundamentalMetric = 'pl' | 'pvp' | 'roe' | 'dividendYield' | 'netDebtToEbitda';

function getMetricColorClass(metric: FundamentalMetric, value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'text-muted-foreground';

  // Use the recommendation field's red → orange → yellow → lime → green scale.
  if (metric === 'pl') {
    if (value <= 0) return 'text-muted-foreground';
    if (value <= 10) return 'text-green-600 dark:text-green-400';
    if (value <= 15) return 'text-lime-600 dark:text-lime-400';
    if (value <= 25) return 'text-yellow-600 dark:text-yellow-400';
    if (value <= 35) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  }

  if (metric === 'pvp') {
    if (value <= 1) return 'text-green-600 dark:text-green-400';
    if (value <= 2) return 'text-lime-600 dark:text-lime-400';
    if (value <= 4) return 'text-yellow-600 dark:text-yellow-400';
    if (value <= 8) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  }

  if (metric === 'roe') {
    if (value <= 0) return 'text-red-600 dark:text-red-400';
    if (value < 0.05) return 'text-orange-600 dark:text-orange-400';
    if (value < 0.1) return 'text-yellow-600 dark:text-yellow-400';
    if (value < 0.15) return 'text-lime-600 dark:text-lime-400';
    return 'text-green-600 dark:text-green-400';
  }

  if (metric === 'netDebtToEbitda') {
    if (value <= 2) return 'text-green-600 dark:text-green-400';
    if (value <= 2.5) return 'text-lime-600 dark:text-lime-400';
    if (value <= 3.5) return 'text-yellow-600 dark:text-yellow-400';
    if (value <= 4) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  }

  if (value >= 6) return 'text-green-600 dark:text-green-400';
  if (value >= 4) return 'text-lime-600 dark:text-lime-400';
  if (value >= 2) return 'text-yellow-600 dark:text-yellow-400';
  if (value >= 1) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function DetailField({
  label,
  value,
  valueClassName = '',
  help,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  help?: string;
}): React.JSX.Element {
  const [showHelp, setShowHelp] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isHelpVisible = showHelp || isHovered;

  return (
    <div
      className="relative min-w-0"
      onMouseEnter={() => { if (help) setIsHovered(true); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {help && (
          <button
            type="button"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`About ${label}`}
            aria-expanded={isHelpVisible}
            onClick={() => setShowHelp((visible) => !visible)}
          >
            <Info className="h-3 w-3" />
          </button>
        )}
      </dt>
      <dd className={`mt-0.5 break-words text-sm font-medium ${valueClassName}`}>{value}</dd>
      {isHelpVisible && help && (
        <div role="tooltip" className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl ring-1 ring-black/5 sm:w-80">
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Indicator guide</span>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Close ${label} guide`}
              onClick={() => { setShowHelp(false); setIsHovered(false); }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="px-3 py-3 text-xs font-normal leading-relaxed">{help}</p>
        </div>
      )}
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
