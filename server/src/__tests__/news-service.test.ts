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
  summary: string | null;
  summaryStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
}

const xmlItem = (id: number, category: string | null = 'Economia'): string => `<item>
  <guid>story-${id}</guid><title>Story ${id}</title><link>https://www.infomoney.com.br/story-${id}/</link>
  <pubDate>Sun, 08 Nov 2026 10:00:00 GMT</pubDate><description>RSS excerpt for story ${id} includes a detailed account of the economic news, important context, and consequences that readers should understand from the original article.</description>
  ${category ? `<category>${category}</category>` : ''}
</item>`;

const rss = (items: string[]): string => `<rss><channel>${items.join('')}</channel></rss>`;
const longArticleHtml = `<html><body><article><h1>Article</h1><p>${'A detailed report describes the relevant economic event and its wider effects. '.repeat(30)}</p></article></body></html>`;
const geminiResponse = (summary = 'A concise summary of the article.') => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: JSON.stringify({ summary }) }] } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

function makeService(fetchImpl: typeof fetch) {
  const items: StoredNewsItem[] = [];
  let nextId = 1;
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
  const createMany = vi.fn(async ({ data }: { data: Array<Omit<StoredNewsItem, 'id' | 'summary' | 'summaryStatus'>> }) => {
    let count = 0;
    for (const row of data) {
      if (items.some((item) => item.sourceId === row.sourceId || item.link === row.link)) continue;
      items.push({ ...row, id: `news-${nextId++}`, summary: null, summaryStatus: 'PENDING' });
      count += 1;
    }
    return { count };
  });
  const updateMany = vi.fn(async ({ where, data }: {
    where: { id?: string; summaryStatus: 'PENDING' | 'PROCESSING' | 'FAILED' | { in: Array<'PROCESSING' | 'FAILED'> } };
    data: { summaryStatus: StoredNewsItem['summaryStatus'] };
  }) => {
    const statuses = typeof where.summaryStatus === 'string' ? [where.summaryStatus] : where.summaryStatus.in;
    const matching = items.filter((item) => (!where.id || item.id === where.id) && statuses.includes(item.summaryStatus));
    for (const item of matching) item.summaryStatus = data.summaryStatus;
    return { count: matching.length };
  });
  const findFirst = vi.fn(async () => items.find((item) => item.isIncluded && item.summaryStatus === 'PENDING') ?? null);
  const update = vi.fn(async ({ where, data }: {
    where: { id: string };
    data: { summary?: string; summaryStatus: StoredNewsItem['summaryStatus'] };
  }) => {
    const item = items.find(({ id }) => id === where.id);
    if (!item) throw new Error('missing test row');
    item.summary = data.summary ?? item.summary;
    item.summaryStatus = data.summaryStatus;
    return item;
  });
  const db = { newsItem: { findMany, createMany, updateMany, findFirst, update } } as unknown as PrismaClient;
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

  it('summarizes only included stories, falls back to RSS text, and saves the summary', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(rss([xmlItem(1, null), xmlItem(2, 'Esportes'), xmlItem(3, 'Loterias'), xmlItem(4, 'CONSUMO')]), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(geminiResponse());
    const { service, items } = makeService(fetchImpl);

    await expect(service.sync()).resolves.toMatchObject({ feedCount: 4, includedCount: 1, excludedCount: 3 });
    await waitForWorker(service);

    expect(items.find(({ sourceId }) => sourceId === 'story-1')).toMatchObject({
      isIncluded: true,
      summaryStatus: 'READY',
      summary: 'A concise summary of the article.',
    });
    const page = await service.getNews();
    expect(page.included[0]?.summarySource).toBe('RSS_ONLY');
    expect(page.excluded.every(({ summarySource }) => summarySource === 'NOT_FETCHED')).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const requestBody = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    expect(requestBody.contents[0]?.parts[0]?.text).toContain('RSS excerpt for story 1');
  });

  it('extracts article text for the summary and does not generate a second summary on later visits', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(rss([xmlItem(1)]), { status: 200 }))
      .mockResolvedValueOnce(new Response(longArticleHtml, { status: 200, headers: { 'Content-Type': 'text/html' } }))
      .mockResolvedValueOnce(geminiResponse('Summary based on the full article.'));
    const { service } = makeService(fetchImpl);

    await service.sync();
    await waitForWorker(service);
    await expect(service.getNews()).resolves.toMatchObject({ included: [{ summarySource: 'FULL_ARTICLE' }] });
    const firstGeminiBody = String(fetchImpl.mock.calls[2]?.[1]?.body);
    expect(firstGeminiBody).toContain('detailed report describes the relevant economic event');
    expect(firstGeminiBody).not.toContain('RSS excerpt for story 1');

    fetchImpl.mockResolvedValueOnce(new Response(rss([xmlItem(1)]), { status: 200 }));
    await expect(service.sync()).resolves.toMatchObject({ addedCount: 0 });
    await waitForWorker(service);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('marks failed summaries for retry on the next visit without losing imported stories', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(rss([xmlItem(1)]), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { status: 'QUOTA_EXCEEDED' } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(rss([xmlItem(1)]), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(geminiResponse('Retry succeeded.'));
    const { service, items } = makeService(fetchImpl);

    await service.sync();
    await waitForWorker(service);
    expect((await service.getNews()).included).toHaveLength(1);
    expect(items[0]?.summaryStatus).toBe('FAILED');

    await service.sync();
    await waitForWorker(service);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ summaryStatus: 'READY', summary: 'Retry succeeded.' });
  });
});
