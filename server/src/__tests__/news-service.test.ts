import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createNewsService, NEWS_FEED_URL } from '../services/news-service.js';

interface StoredNewsItem {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  publishedAt: Date;
  categories: string[];
  description: string;
  isIncluded: boolean;
  content: string | null;
  contentStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  contentSource: 'FULL_ARTICLE' | 'RSS_ONLY' | null;
  summary: string | null;
  summaryStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
}

type NewNewsItem = Pick<StoredNewsItem, 'sourceId' | 'title' | 'link' | 'publishedAt' | 'categories' | 'description' | 'isIncluded'>;

const xmlItem = (id: number, category: string | null = 'Economia'): string => `<item>
  <guid>story-${id}</guid><title>Story ${id}</title><link>https://www.infomoney.com.br/story-${id}/</link>
  <pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate><description>RSS excerpt for story ${id} includes a detailed account of the economic news, important context, and consequences that readers should understand from the original article.</description>
  ${category ? `<category>${category}</category>` : ''}
</item>`;

const rss = (items: string[]): string => `<rss><channel>${items.join('')}</channel></rss>`;
const longArticleHtml = `<html><body><article><h1>Article</h1><p>${'First paragraph describes the relevant economic event and its wider effects. '.repeat(10)}</p><p>${'Second paragraph adds context and reported consequences for readers. '.repeat(10)}</p></article></body></html>`;
const geminiResponse = (summary = 'A concise summary of the article.') => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: JSON.stringify({ summary }) }] } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

function makeService(fetchImpl: typeof fetch) {
  const items: StoredNewsItem[] = [];
  let nextId = 1;

  const matchesStatus = (
    item: StoredNewsItem,
    field: 'contentStatus' | 'summaryStatus',
    expected: string | { in: string[] } | undefined,
  ): boolean => {
    if (expected === undefined) return true;
    return typeof expected === 'string' ? item[field] === expected : expected.in.includes(item[field]);
  };

  const findMany = vi.fn(async (args: {
    where?: { OR?: Array<{ link?: { in: string[] }; sourceId?: { in: string[] } }> };
    select?: { sourceId?: boolean; link?: boolean };
  } = {}) => {
    const matches = args.where?.OR
      ? items.filter((item) => args.where?.OR?.some((condition) =>
        condition.link?.in.includes(item.link) || condition.sourceId?.in.includes(item.sourceId)))
      : [...items].sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
    return args.select ? matches.map(({ sourceId, link }) => ({ sourceId, link })) : matches;
  });

  const createMany = vi.fn(async ({ data }: { data: NewNewsItem[] }) => {
    let count = 0;
    for (const row of data) {
      if (items.some((item) => item.sourceId === row.sourceId || item.link === row.link)) continue;
      items.push({
        ...row,
        id: `news-${nextId++}`,
        content: null,
        contentStatus: 'PENDING',
        contentSource: null,
        summary: null,
        summaryStatus: 'PENDING',
      });
      count += 1;
    }
    return { count };
  });

  const updateMany = vi.fn(async ({ where, data }: {
    where: {
      id?: string;
      contentStatus?: string | { in: string[] };
      summaryStatus?: string | { in: string[] };
    };
    data: Partial<Pick<StoredNewsItem, 'contentStatus' | 'summaryStatus'>>;
  }) => {
    const matching = items.filter((item) =>
      (!where.id || item.id === where.id)
      && matchesStatus(item, 'contentStatus', where.contentStatus)
      && matchesStatus(item, 'summaryStatus', where.summaryStatus));
    for (const item of matching) Object.assign(item, data);
    return { count: matching.length };
  });

  const findFirst = vi.fn(async () => [...items]
    .filter((item) => item.isIncluded && item.contentStatus === 'PENDING')
    .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime())[0] ?? null);

  const findUnique = vi.fn(async ({ where }: { where: { id: string } }) =>
    items.find(({ id }) => id === where.id) ?? null);

  const update = vi.fn(async ({ where, data }: {
    where: { id: string };
    data: Partial<Pick<StoredNewsItem, 'content' | 'contentSource' | 'contentStatus' | 'summary' | 'summaryStatus'>>;
  }) => {
    const item = items.find(({ id }) => id === where.id);
    if (!item) throw new Error('missing test row');
    Object.assign(item, data);
    return item;
  });

  const db = { newsItem: { findMany, createMany, updateMany, findFirst, findUnique, update } } as unknown as PrismaClient;
  const service = createNewsService({ db, fetchImpl, apiKey: 'test-key', retryDelayMs: 0 });
  return { service, items, findMany, createMany };
}

async function waitForWorker(service: ReturnType<typeof createNewsService>): Promise<void> {
  await vi.waitFor(async () => {
    const data = await service.getNews();
    expect(data.progress.pending + data.progress.processing).toBe(0);
  });
}

beforeEach(() => vi.restoreAllMocks());

describe('news service', () => {
  it('imports every feed entry, classifies RSS categories, sorts stories, and reports current-feed counts', async () => {
    const feed = rss([
      xmlItem(1, 'Esportes'),
      xmlItem(2, 'Esportes'),
      xmlItem(3, 'Esportes'),
      xmlItem(4, 'Esportes'),
      ...Array.from({ length: 102 }, (_, index) => xmlItem(index + 5, 'Esportes')),
    ]);
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(feed, { status: 200 }));
    const { service, items, createMany } = makeService(fetchImpl);

    const stats = await service.sync();
    await waitForWorker(service);

    expect(fetchImpl).toHaveBeenCalledWith(NEWS_FEED_URL, expect.any(Object));
    expect(stats).toEqual({ feedCount: 106, includedCount: 0, excludedCount: 106, addedCount: 106 });
    expect(items).toHaveLength(106);
    expect(items.filter(({ isIncluded }) => isIncluded)).toHaveLength(0);
    expect(createMany).toHaveBeenCalledOnce();
    const again = await service.sync();
    expect(again.addedCount).toBe(0);
    expect(items).toHaveLength(106);
  });

  it('saves the original article text without generating a summary automatically', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(rss([xmlItem(1), xmlItem(2, 'Esportes'), xmlItem(3, 'Loterias'), xmlItem(4, 'CONSUMO')]), { status: 200 }))
      .mockResolvedValueOnce(new Response(longArticleHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }));
    const { service, items } = makeService(fetchImpl);

    await expect(service.sync()).resolves.toMatchObject({ feedCount: 4, includedCount: 1, excludedCount: 3 });
    await waitForWorker(service);

    const saved = items.find(({ sourceId }) => sourceId === 'story-1');
    expect(saved).toMatchObject({
      contentStatus: 'READY',
      contentSource: 'FULL_ARTICLE',
      summary: null,
      summaryStatus: 'PENDING',
    });
    expect(saved?.content).toContain('First paragraph describes');
    expect(saved?.content).toContain('\n\n');
    expect(saved?.content).toContain('Second paragraph adds');
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const page = await service.getNews();
    expect(page.included[0]).toMatchObject({
      contentStatus: 'READY',
      contentSource: 'FULL_ARTICLE',
      summary: null,
      summaryStatus: 'PENDING',
    });
    expect(page.excluded.every(({ contentSource }) => contentSource === 'NOT_FETCHED')).toBe(true);
    expect(page.progress).toEqual({ total: 1, ready: 1, pending: 0, processing: 0, failed: 0 });
  });

  it('falls back to the RSS text when the article page cannot be fetched', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(rss([xmlItem(1)]), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 403 }));
    const { service, items } = makeService(fetchImpl);

    await service.sync();
    await waitForWorker(service);

    const saved = items[0];
    expect(saved).toMatchObject({ contentStatus: 'READY', contentSource: 'RSS_ONLY' });
    expect(saved?.content).toContain('RSS excerpt for story 1');
    await expect(service.getOriginalText(saved!.id)).resolves.toEqual({
      text: saved?.content,
      source: 'RSS_ONLY',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('generates and saves a summary only when explicitly requested', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(rss([xmlItem(1)]), { status: 200 }))
      .mockResolvedValueOnce(new Response(longArticleHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }));
    const { service, items } = makeService(fetchImpl);

    await service.sync();
    await waitForWorker(service);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(items[0]?.summary).toBeNull();

    fetchImpl.mockResolvedValueOnce(geminiResponse('Summary generated on demand.'));
    await expect(service.summarize(items[0]!.id)).resolves.toEqual({ summary: 'Summary generated on demand.' });
    expect(items[0]).toMatchObject({ summary: 'Summary generated on demand.', summaryStatus: 'READY' });

    const requestBody = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(requestBody.contents[0]?.parts[0]?.text).toContain('First paragraph describes');
    expect(requestBody.contents[0]?.parts[0]?.text).toContain('Second paragraph adds');

    await expect(service.summarize(items[0]!.id)).resolves.toEqual({ summary: 'Summary generated on demand.' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('marks a failed on-demand summary and allows retrying it', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(rss([xmlItem(1)]), { status: 200 }))
      .mockResolvedValueOnce(new Response(longArticleHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { status: 'QUOTA_EXCEEDED' } }), { status: 429 }));
    const { service, items } = makeService(fetchImpl);

    await service.sync();
    await waitForWorker(service);
    await expect(service.summarize(items[0]!.id)).rejects.toThrow('GEMINI_HTTP_429');
    expect(items[0]?.summaryStatus).toBe('FAILED');

    fetchImpl.mockResolvedValueOnce(geminiResponse('Retry succeeded.'));
    await expect(service.summarize(items[0]!.id)).resolves.toEqual({ summary: 'Retry succeeded.' });
    expect(items[0]).toMatchObject({ summaryStatus: 'READY', summary: 'Retry succeeded.' });
  });
});
