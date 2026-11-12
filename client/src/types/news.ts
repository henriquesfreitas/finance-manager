export type NewsContentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type NewsContentSource = 'FULL_ARTICLE' | 'RSS_ONLY';
export type NewsSource = NewsContentSource | 'NOT_FETCHED';
export type NewsSummaryStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  contentStatus: NewsContentStatus;
  contentSource: NewsSource | null;
  summary: string | null;
  summaryStatus: NewsSummaryStatus;
}

export interface NewsPageData {
  included: NewsArticle[];
  excluded: Array<Pick<NewsArticle, 'id' | 'title' | 'link' | 'publishedAt' | 'contentSource'>>;
  progress: { total: number; ready: number; pending: number; processing: number; failed: number };
}

export interface NewsSyncStats {
  feedCount: number;
  includedCount: number;
  excludedCount: number;
  addedCount: number;
}

export interface NewsOriginalText {
  text: string;
  source: NewsContentSource;
}

export interface NewsSummary {
  summary: string;
}
