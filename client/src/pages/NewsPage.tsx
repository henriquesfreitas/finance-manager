import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Newspaper, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';
import { ThemeToggle } from '../components/ThemeToggle';
import { useNews, useNewsOriginalText, useSummarizeNews, useSyncNews } from '../hooks/useNews';
import { getInitialNewsLanguage, newsCopy, saveNewsLanguage, type NewsLanguage } from '../i18n/news';
import type { NewsArticle, NewsContentStatus, NewsSource } from '../types/news';

type NewsCopy = (typeof newsCopy)[NewsLanguage];

interface IncludedNewsCardProps {
  article: NewsArticle;
  copy: NewsCopy;
  formatDate: (value: string) => string;
  sourceLabel: (source: NewsSource | null, status?: NewsContentStatus) => string;
}

function contentParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
}

function IncludedNewsCard({ article, copy, formatDate, sourceLabel }: IncludedNewsCardProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const originalText = useNewsOriginalText(article.id, isExpanded && article.contentStatus === 'READY');
  const summarize = useSummarizeNews(article.id);
  const generateSummary = summarize.mutate;
  const isGenerating = summarize.isPending || article.summaryStatus === 'PROCESSING';
  const summaryText = summarize.data?.summary ?? (article.summaryStatus === 'READY' ? article.summary : null);
  const canSummarize = article.contentStatus === 'READY';
  const summaryFailed = article.summaryStatus === 'FAILED' || summarize.isError;
  const shouldLoadSummary = canSummarize && !summaryText && !isGenerating && !summarize.isError;

  useEffect(() => {
    if (!shouldLoadSummary || (!isExpanded && !isSummaryVisible)) return;
    generateSummary();
  }, [generateSummary, isExpanded, isSummaryVisible, shouldLoadSummary]);

  return (
    <li className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <time className="text-xs text-muted-foreground" dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{sourceLabel(article.contentSource, article.contentStatus)}</span>
        </div>
        <a className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={article.link} target="_blank" rel="noopener noreferrer">
          {copy.openStory}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      <h3 className="text-lg font-semibold leading-snug">
        <button
          type="button"
          className="text-left hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={isExpanded}
          onClick={() => { setIsExpanded((current) => !current); }}
        >
          {article.title}
        </button>
      </h3>
      <div className="mt-2">
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          aria-expanded={isSummaryVisible}
          onClick={() => { setIsSummaryVisible((current) => !current); }}
        >
          {isSummaryVisible ? copy.hideSummary : copy.showSummary}
        </button>
      </div>
      {isSummaryVisible && (
        <div className="mt-3 rounded-md border bg-muted/30 p-4">
          {isGenerating
            ? <p role="status" className="text-sm text-muted-foreground">{copy.summaryPending}</p>
            : summaryText
              ? (
                <>
                  <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.summary}</h4>
                  <p className="whitespace-pre-wrap text-base leading-7 text-muted-foreground">{summaryText}</p>
                </>
              )
              : canSummarize
                ? (
                  <>
                    {summaryFailed && <p role="alert" className="mb-2 text-sm text-destructive">{copy.summaryFailed}</p>}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-60"
                      onClick={() => { generateSummary(); }}
                      disabled={summarize.isPending}
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      {copy.summarize}
                    </button>
                  </>
                )
                : article.contentStatus === 'FAILED'
                  ? <p className="text-sm text-muted-foreground">{copy.articleTextFailed}</p>
                  : <p className="text-sm text-muted-foreground">{copy.articleTextPending}</p>}
        </div>
      )}
      {isExpanded && (
        <div className="mt-4 border-t pt-3">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.articleText}</h4>
          {article.contentStatus === 'READY'
            ? originalText.isLoading
              ? <p className="text-sm text-muted-foreground">{copy.articleTextLoading}</p>
              : originalText.isError
                ? <p role="alert" className="text-sm text-destructive">{copy.articleTextError}</p>
                : originalText.data?.text
                  ? (
                    <div className="space-y-3 text-base leading-7 text-muted-foreground">
                      {contentParagraphs(originalText.data.text).map((paragraph, index) => (
                        <p key={index} className="whitespace-pre-line">{paragraph}</p>
                      ))}
                    </div>
                  )
                  : <p className="text-sm text-muted-foreground">{copy.articleTextEmpty}</p>
            : article.contentStatus === 'FAILED'
              ? <p className="text-sm text-muted-foreground">{copy.articleTextFailed}</p>
              : <p className="text-sm text-muted-foreground">{copy.articleTextPending}</p>}
        </div>
      )}
    </li>
  );
}

export function NewsPage(): React.JSX.Element {
  const auth = useAuth();
  const { admin } = auth;
  const news = useNews();
  const sync = useSyncNews();
  const syncStarted = useRef(false);
  const [language, setLanguage] = useState<NewsLanguage>(getInitialNewsLanguage);
  const copy = newsCopy[language];
  const data = news.data;

  useEffect(() => {
    if (syncStarted.current) return;
    syncStarted.current = true;
    sync.mutate();
  }, [sync]);

  function changeLanguage(next: NewsLanguage): void {
    setLanguage(next);
    saveNewsLanguage(next);
  }

  async function handleLogout(): Promise<void> {
    await auth.logout();
    window.location.assign('/login');
  }

  function sourceLabel(source: NewsSource | null, status?: NewsContentStatus): string {
    if (status === 'PENDING' || status === 'PROCESSING') return copy.sourceChecking;
    if (status === 'FAILED') return copy.sourceFailed;
    if (source === 'FULL_ARTICLE') return copy.sourceFullArticle;
    if (source === 'RSS_ONLY') return copy.sourceRssOnly;
    if (source === 'NOT_FETCHED') return copy.sourceNotFetched;
    return copy.sourceChecking;
  }

  const formatDate = (value: string): string => new Intl.DateTimeFormat(
    language === 'pt' ? 'pt-BR' : 'en-US',
    { dateStyle: 'medium', timeStyle: 'short' },
  ).format(new Date(value));

  return (
    <div lang={language === 'pt' ? 'pt-BR' : 'en'} className="min-h-screen bg-background text-foreground">
      <header className="bg-primary text-primary-foreground shadow-sm">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Newspaper className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-xl font-semibold">{copy.pageTitle}</h1>
          </div>
          <nav aria-label={copy.mainNavigation} className="flex flex-wrap items-center gap-4 text-sm">
            {admin?.permissions.includes('INVESTMENTS') && <a href="/" className="text-primary-foreground/90 hover:underline">{copy.investments}</a>}
            {admin?.permissions.includes('BILLS_CONTROL') && <a href="/bills-control" className="text-primary-foreground/90 hover:underline">{copy.bills}</a>}
            {admin?.permissions.includes('BUDGET') && <a href="/budgets" className="text-primary-foreground/90 hover:underline">{copy.budgets}</a>}
            <div className="flex items-center gap-1" aria-label={copy.language}>
              <button type="button" className="rounded px-2 py-1 hover:bg-white/15" aria-pressed={language === 'en'} onClick={() => { changeLanguage('en'); }}>EN</button>
              <button type="button" className="rounded px-2 py-1 hover:bg-white/15" aria-pressed={language === 'pt'} onClick={() => { changeLanguage('pt'); }}>PT</button>
            </div>
            <ThemeToggle onHeader />
            <button type="button" className="rounded px-2 py-1 hover:bg-white/15" onClick={() => void handleLogout()}>
              {copy.signOut}{admin?.username ? ` (${admin.username})` : ''}
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 py-8">
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">{copy.pageTitle}</h2>
            <a className="text-sm text-muted-foreground underline underline-offset-4" href="https://www.infomoney.com.br/feed/" target="_blank" rel="noreferrer">
              {copy.feedLink}
            </a>
          </div>
          {(sync.isPending || (news.isLoading && !data)) && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              {sync.isPending ? copy.syncing : copy.loading}
            </div>
          )}
        </section>

        {news.isError && <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{copy.loadError}</div>}
        {sync.isError && <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{copy.syncError}</div>}

        {sync.data && (
          <p className="mb-2 text-sm text-muted-foreground">
            {copy.syncCounts(sync.data.feedCount, sync.data.includedCount, sync.data.excludedCount)}
          </p>
        )}
        {data && (
          <div className="mb-5 space-y-1 text-sm text-muted-foreground" aria-live="polite">
            <p>{copy.contentProgress(data.progress.ready, data.progress.total, data.progress.processing, data.progress.pending)}</p>
          </div>
        )}

        {!news.isLoading && data && data.included.length === 0 && data.excluded.length === 0 && !sync.isPending && (
          <section className="rounded-xl border bg-card px-6 py-12 text-center shadow-sm">
            <h2 className="mb-2 text-lg font-semibold">{copy.emptyTitle}</h2>
            <p className="text-sm text-muted-foreground">{copy.emptyDescription}</p>
          </section>
        )}

        {data && data.included.length === 0 && data.excluded.length > 0 && (
          <p className="mb-6 text-sm text-muted-foreground">{copy.noIncluded}</p>
        )}

        {data && data.included.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">{copy.includedStories}</h2>
            <ol className="space-y-4">
              {data.included.map((article) => (
                <IncludedNewsCard key={article.id} article={article} copy={copy} formatDate={formatDate} sourceLabel={sourceLabel} />
              ))}
            </ol>
          </section>
        )}

        {data && data.excluded.length > 0 && (
          <section className="mt-10 rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">{copy.excludedStories}</h2>
            <ul className="space-y-2">
              {data.excluded.map((article) => (
                <li key={article.id} className="border-b pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a className="text-sm text-primary hover:underline" href={article.link} target="_blank" rel="noopener noreferrer">
                      {article.title}<ExternalLink className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{sourceLabel(article.contentSource)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
