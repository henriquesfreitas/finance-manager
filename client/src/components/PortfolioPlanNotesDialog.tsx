import React from 'react';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getInitialPortfolioPlanLanguage, portfolioPlanCopy } from '@/i18n/portfolio-plan';
import { sanitizeCommentHtml } from '@/lib/sanitize-comment-html';
import type { PortfolioCommentItem } from '@/types/portfolio-comment';
import {
  useCreatePortfolioComment,
  useDeletePortfolioComment,
  usePortfolioComments,
  useUpdatePortfolioComment,
} from '@/hooks/usePortfolioComments';

function formatDateTime(value: string, language: 'en' | 'pt'): string {
  return new Date(value).toLocaleString(language === 'pt' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function PortfolioPlanNotesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const language = getInitialPortfolioPlanLanguage();
  const copy = portfolioPlanCopy[language];
  const { data: comments, isLoading, isError, refetch } = usePortfolioComments(open);
  const createComment = useCreatePortfolioComment();

  function handleCreate(content: string, onSuccess: () => void): void {
    createComment.mutate(content, {
      onSuccess: () => {
        onSuccess();
        toast.success(copy.added);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <AddPortfolioNoteForm
          placeholder={copy.addPlaceholder}
          submitLabel={copy.add}
          pendingLabel={copy.adding}
          characterCount={copy.characterCount}
          isPending={createComment.isPending}
          onSubmit={handleCreate}
        />
        <section className="grid max-h-[50vh] gap-2 overflow-y-auto" aria-label={copy.title}>
          {isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{copy.loading}</p>
          ) : isError ? (
            <div className="grid justify-items-center gap-2 py-4 text-sm text-destructive" role="alert">
              <p>{copy.loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => { void refetch(); }}>
                {language === 'pt' ? 'Tentar novamente' : 'Retry'}
              </Button>
            </div>
          ) : comments?.length ? (
            comments.map((comment) => (
              <PortfolioNoteRow key={comment.id} comment={comment} language={language} />
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">{copy.empty}</p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function AddPortfolioNoteForm({
  placeholder,
  submitLabel,
  pendingLabel,
  characterCount,
  isPending,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  pendingLabel: string;
  characterCount: (count: number) => string;
  isPending: boolean;
  onSubmit: (content: string, onSuccess: () => void) => void;
}): React.JSX.Element {
  const [content, setContent] = React.useState('');
  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSubmit(trimmed, () => setContent(''));
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2">
      <textarea
        className="min-h-[88px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder={placeholder}
        aria-label={placeholder}
        value={content}
        maxLength={10000}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{characterCount(content.length)}</span>
        <Button type="submit" size="sm" disabled={!content.trim() || isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function PortfolioNoteRow({ comment, language }: { comment: PortfolioCommentItem; language: 'en' | 'pt' }): React.JSX.Element {
  const copy = portfolioPlanCopy[language];
  const [editing, setEditing] = React.useState(false);
  const [content, setContent] = React.useState(comment.content);
  const updateComment = useUpdatePortfolioComment();
  const deleteComment = useDeletePortfolioComment();

  function handleSave(): void {
    const trimmed = content.trim();
    if (!trimmed) return;
    updateComment.mutate({ id: comment.id, content: trimmed }, {
      onSuccess: () => {
        setEditing(false);
        toast.success(copy.updated);
      },
      onError: (error) => toast.error(error.message),
    });
  }

  function handleDelete(): void {
    deleteComment.mutate(comment.id, {
      onSuccess: () => toast.success(copy.deleted),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <article className="grid gap-2 rounded-md border bg-muted/30 px-3 py-2.5">
      {editing ? (
        <>
          <textarea
            className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={content}
            maxLength={10000}
            aria-label={copy.edit}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="flex justify-end gap-1">
            <Button type="button" size="sm" variant="ghost" aria-label={copy.save} disabled={!content.trim() || updateComment.isPending} onClick={handleSave}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label={copy.cancel} onClick={() => { setContent(comment.content); setEditing(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div
            className="overflow-x-auto whitespace-pre-wrap text-sm [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(comment.content) }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {formatDateTime(comment.createdAt, language)}{comment.updatedAt !== comment.createdAt && ` ${copy.edited}`}
            </span>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label={copy.edit} onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" aria-label={copy.delete} disabled={deleteComment.isPending} onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
