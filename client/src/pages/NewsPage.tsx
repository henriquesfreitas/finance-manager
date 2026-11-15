import React, { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Code2,
  ExternalLink,
  Languages,
  Loader2,
  LogIn,
  Newspaper,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useNewsFeed } from '@/hooks/useNews';
import { BASE_URL } from '@/services/api-client';
import type { ExcludedNewsFeedItem, NewsFeedItem } from '@/services/news-api-client';

type NewsLanguage = 'en' | 'pt';
type NewsView = 'included' | 'excluded' | 'xml';

const LANGUAGE_STORAGE_KEY = 'finance-manager:news-language';
const FEED_XML_URL = `${BASE_URL}/api/news/feed`;

const copy = {
  en: {
    title: 'News',
    subtitle:
      'Current InfoMoney stories, showing what stays in the RSS feed and what the filter removes.',
    included: 'Included',
    excluded: 'Excluded',
    xml: 'XML feed',
    filter: 'Active filter',
    filterNote: 'Stories with any of these categories are removed from the filtered RSS.',
    excludedNote: 'These stories are in the original feed but are removed from the filtered RSS.',
    excludedBy: 'Excluded by',
    lastBuildDate: 'Feed last built',
    openXml: 'Open raw filtered XML',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    signIn: 'Sign in',
    readMore: 'Read on InfoMoney',
    loading: 'Loading news…',
    retry: 'Try again',
    error: 'Unable to load the news feed right now. Please try again.',
    noIncluded: 'No stories currently pass the filter.',
    noExcluded: 'No stories are currently excluded.',
    language: 'Switch language',
    source: 'Source: InfoMoney RSS feed',
  },
  pt: {
    title: 'Notícias',
    subtitle:
      'Notícias atuais do InfoMoney, mostrando o que entra no feed RSS e o que o filtro remove.',
    included: 'Incluídas',
    excluded: 'Excluídas',
    xml: 'Feed XML',
    filter: 'Filtro ativo',
    filterNote: 'Notícias com qualquer uma destas categorias são removidas do RSS filtrado.',
    excludedNote: 'Estas notícias estão no feed original, mas são removidas do RSS filtrado.',
    excludedBy: 'Excluída por',
    lastBuildDate: 'Feed atualizado em',
    openXml: 'Abrir XML filtrado bruto',
    refresh: 'Atualizar',
    refreshing: 'Atualizando…',
    signIn: 'Entrar',
    readMore: 'Ler no InfoMoney',
    loading: 'Carregando notícias…',
    retry: 'Tentar novamente',
    error: 'Não foi possível carregar o feed de notícias agora. Tente novamente.',
    noIncluded: 'Nenhuma notícia passa pelo filtro agora.',
    noExcluded: 'Nenhuma notícia está excluída agora.',
    language: 'Mudar idioma',
    source: 'Fonte: feed RSS do InfoMoney',
  },
} as const;

function initialLanguage(): NewsLanguage {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'pt') return saved;
  } catch {
    // Fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function formatDate(value: string | null, language: NewsLanguage): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function StoryCard({
  item,
  language,
  matchedCategories,
}: {
  item: NewsFeedItem | ExcludedNewsFeedItem;
  language: NewsLanguage;
  matchedCategories?: string[];
}): React.JSX.Element {
  const text = copy[language];
  const formattedDate = formatDate(item.publishedAt, language);
  const isExcluded = matchedCategories !== undefined;

  return (
    <li
      className={
        isExcluded
          ? 'rounded-xl border border-destructive/30 bg-destructive/5 p-5'
          : 'rounded-xl border bg-card p-5 shadow-sm'
      }
    >
      {isExcluded && matchedCategories.length > 0 && (
        <p className="mb-3 inline-flex flex-wrap items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
          <Ban className="size-3.5" aria-hidden="true" />
          {text.excludedBy}: {matchedCategories.join(', ')}
        </p>
      )}

      {item.categories.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2" aria-label="Categories">
          {item.categories.map((category) => (
            <li
              key={category}
              className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {category}
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-lg font-semibold leading-snug">
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary hover:underline"
        >
          {item.title}
        </a>
      </h2>

      {formattedDate && (
        <time
          dateTime={item.publishedAt ?? undefined}
          className="mt-1 block text-xs text-muted-foreground"
        >
          {formattedDate}
        </time>
      )}

      {item.summary && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>
      )}

      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {text.readMore}
        <ExternalLink className="size-3.5" aria-hidden="true" />
      </a>
    </li>
  );
}

export function NewsPage(): React.JSX.Element {
  const [language, setLanguage] = useState<NewsLanguage>(initialLanguage);
  const [view, setView] = useState<NewsView>('included');
  const { data, isLoading, isError, isFetching, refetch } = useNewsFeed();
  const text = copy[language];

  function toggleLanguage(): void {
    const next = language === 'en' ? 'pt' : 'en';
    setLanguage(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Persisting the choice is optional.
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <Newspaper className="size-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold">{text.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              aria-label={text.language}
              title={text.language}
            >
              <Languages aria-hidden="true" />
              {language === 'en' ? 'PT' : 'EN'}
            </Button>
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <a href="/login">
                <LogIn aria-hidden="true" />
                {text.signIn}
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-muted-foreground">{text.subtitle}</p>

        {data?.lastBuildDate && (
          <p className="mt-1 text-xs text-muted-foreground">
            {text.lastBuildDate}: {formatDate(data.lastBuildDate, language)}
          </p>
        )}

        {data && (
          <section
            className="mt-5 rounded-xl border bg-card p-4"
            aria-labelledby="news-filter-heading"
          >
            <h2
              id="news-filter-heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {text.filter}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {data.filter.map((category) => (
                <li
                  key={category}
                  className="rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
                >
                  {category}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">{text.filterNote}</p>
          </section>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label={text.title}>
            <Button
              type="button"
              size="sm"
              variant={view === 'included' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'included'}
              onClick={() => {
                setView('included');
              }}
            >
              <CheckCircle2 aria-hidden="true" />
              {text.included}
              {data ? <span className="tabular-nums">({data.included.length})</span> : null}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'excluded' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'excluded'}
              onClick={() => {
                setView('excluded');
              }}
            >
              <Ban aria-hidden="true" />
              {text.excluded}
              {data ? <span className="tabular-nums">({data.excluded.length})</span> : null}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === 'xml' ? 'secondary' : 'ghost'}
              aria-pressed={view === 'xml'}
              onClick={() => {
                setView('xml');
              }}
            >
              <Code2 aria-hidden="true" />
              {text.xml}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              {isFetching ? text.refreshing : text.refresh}
            </Button>

            <a
              href={FEED_XML_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {text.openXml}
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>

        {isLoading && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
            {text.loading}
          </div>
        )}

        {!isLoading && isError && (
          <div role="alert" className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-muted-foreground">{text.error}</p>
            <Button type="button" size="sm" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              {text.retry}
            </Button>
          </div>
        )}

        {!isLoading &&
          !isError &&
          data &&
          view === 'included' &&
          (data.included.length > 0 ? (
            <ul className="mt-6 space-y-4">
              {data.included.map((item) => (
                <StoryCard key={item.id} item={item} language={language} />
              ))}
            </ul>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">{text.noIncluded}</p>
          ))}

        {!isLoading && !isError && data && view === 'excluded' && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">{text.excludedNote}</p>
            {data.excluded.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {data.excluded.map((item) => (
                  <StoryCard
                    key={item.id}
                    item={item}
                    language={language}
                    matchedCategories={item.matchedCategories}
                  />
                ))}
              </ul>
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">{text.noExcluded}</p>
            )}
          </>
        )}

        {!isLoading && !isError && data && view === 'xml' && (
          <pre className="mt-6 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-muted p-4 text-xs leading-relaxed">
            {data.xml}
          </pre>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">{text.source}</p>
      </main>
    </div>
  );
}
