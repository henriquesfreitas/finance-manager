import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { AppPermission } from '../generated/prisma/client.js';

const fakePrisma = {
  newsItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('../lib/prisma-client.js', () => ({ prisma: fakePrisma }));

const { createNewsRouter } = await import('../routes/news-routes.js');
const { requirePermission } = await import('../middleware/permission-middleware.js');

function buildApp(): express.Express {
  const app = express();
  app.use((req, _res, next) => {
    req.permissions = (req.header('x-permissions')?.split(',') ?? []) as AppPermission[];
    next();
  });
  app.use('/api/news', requirePermission('NEWS'));
  app.use('/api', createNewsRouter());
  return app;
}

const geminiResponse = (summary = 'A concise summary of the saved article.') => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: JSON.stringify({ summary }) }] } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  fakePrisma.newsItem.findMany.mockResolvedValue([]);
  fakePrisma.newsItem.findUnique.mockResolvedValue(null);
  fakePrisma.newsItem.createMany.mockResolvedValue({ count: 0 });
  fakePrisma.newsItem.updateMany.mockResolvedValue({ count: 0 });
  fakePrisma.newsItem.findFirst.mockResolvedValue(null);
  fakePrisma.newsItem.update.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('news routes', () => {
  it('denies requests without NEWS permission before reading persisted data', async () => {
    const response = await request(buildApp()).get('/api/news').set('x-permissions', 'INVESTMENTS');
    expect(response.status).toBe(403);
    expect(fakePrisma.newsItem.findMany).not.toHaveBeenCalled();
  });

  it('returns the persisted story lists and saved article status to NEWS users', async () => {
    fakePrisma.newsItem.findMany.mockResolvedValueOnce([{
      id: 'story-1',
      title: 'Saved story',
      link: 'https://www.infomoney.com.br/saved/',
      publishedAt: new Date('2026-11-08T12:00:00.000Z'),
      isIncluded: true,
      contentStatus: 'READY',
      contentSource: 'FULL_ARTICLE',
      summary: null,
      summaryStatus: 'PENDING',
    }]);
    const response = await request(buildApp()).get('/api/news').set('x-permissions', 'NEWS');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      included: [{ id: 'story-1', title: 'Saved story', contentStatus: 'READY', contentSource: 'FULL_ARTICLE', summaryStatus: 'PENDING' }],
      excluded: [],
      progress: { total: 1, ready: 1 },
    });
  });

  it('protects automatic feed sync with NEWS permission', async () => {
    const response = await request(buildApp()).post('/api/news/sync').set('x-permissions', 'BILLS_CONTROL');
    expect(response.status).toBe(403);
    expect(fakePrisma.newsItem.createMany).not.toHaveBeenCalled();
  });

  it('returns the saved original article text without fetching the article again', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({
      content: 'Saved original article text with paragraphs.',
      contentSource: 'FULL_ARTICLE',
      isIncluded: true,
    });
    const response = await request(buildApp()).get('/api/news/story-1/original-text').set('x-permissions', 'NEWS');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'Saved original article text with paragraphs.', source: 'FULL_ARTICLE' });
    expect(fakePrisma.newsItem.findUnique).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      select: { content: true, contentSource: true, isIncluded: true },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not return article text before it is saved or for excluded stories', async () => {
    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({ content: null, contentSource: null, isIncluded: true });
    const pending = await request(buildApp()).get('/api/news/story-1/original-text').set('x-permissions', 'NEWS');
    expect(pending.status).toBe(404);

    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({ content: 'Hidden text.', contentSource: 'RSS_ONLY', isIncluded: false });
    const excluded = await request(buildApp()).get('/api/news/story-2/original-text').set('x-permissions', 'NEWS');
    expect(excluded.status).toBe(404);
  });

  it('generates a summary only when requested by an authorized user', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(geminiResponse());
    vi.stubGlobal('fetch', fetchMock);
    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({
      content: 'Saved original article text used for the on-demand summary.',
      isIncluded: true,
      summary: null,
      summaryStatus: 'PENDING',
    });
    fakePrisma.newsItem.updateMany.mockResolvedValueOnce({ count: 1 });

    const response = await request(buildApp()).post('/api/news/story-1/summary').set('x-permissions', 'NEWS');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ summary: 'A concise summary of the saved article.' });
    expect(fakePrisma.newsItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'story-1', summaryStatus: { in: ['PENDING', 'FAILED', 'READY'] } },
      data: { summaryStatus: 'PROCESSING' },
    });
    expect(fakePrisma.newsItem.update).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      data: { summary: 'A concise summary of the saved article.', summaryStatus: 'READY' },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects summary requests for excluded or missing stories', async () => {
    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({ content: 'Hidden text.', isIncluded: false, summary: null, summaryStatus: 'PENDING' });
    const response = await request(buildApp()).post('/api/news/story-2/summary').set('x-permissions', 'NEWS');
    expect(response.status).toBe(404);
  });
});
