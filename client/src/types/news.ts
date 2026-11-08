export type NewsSummaryStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type NewsSummarySource = 'FULL_ARTICLE' | 'RSS_ONLY' | 'NOT_FETCHED' | 'UNKNOWN';

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  summary: string | null;
  summaryStatus: NewsSummaryStatus;
  summarySource: NewsSummarySource | null;
}

export interface NewsPageData {
  included: NewsArticle[];
  excluded: Array<Pick<NewsArticle, 'id' | 'title' | 'link' | 'publishedAt' | 'summarySource'>>;
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
  source: 'FULL_ARTICLE' | 'RSS_ONLY';
}
