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

beforeEach(() => {
  vi.clearAllMocks();
  fakePrisma.newsItem.findMany.mockResolvedValue([]);
  fakePrisma.newsItem.findUnique.mockResolvedValue(null);
  fakePrisma.newsItem.createMany.mockResolvedValue({ count: 0 });
  fakePrisma.newsItem.updateMany.mockResolvedValue({ count: 0 });
  fakePrisma.newsItem.findFirst.mockResolvedValue(null);
});

afterEach(() => vi.unstubAllGlobals());

describe('news routes', () => {
  it('denies requests without NEWS permission before reading persisted data', async () => {
    const response = await request(buildApp()).get('/api/news').set('x-permissions', 'INVESTMENTS');
    expect(response.status).toBe(403);
    expect(fakePrisma.newsItem.findMany).not.toHaveBeenCalled();
  });

  it('returns the persisted story lists and summary status to NEWS users', async () => {
    fakePrisma.newsItem.findMany.mockResolvedValueOnce([{
      id: 'story-1',
      title: 'Saved story',
      link: 'https://www.infomoney.com.br/saved/',
      publishedAt: new Date('2026-11-08T12:00:00.000Z'),
      isIncluded: true,
      summary: null,
      summaryStatus: 'PENDING',
    }]);
    const response = await request(buildApp()).get('/api/news').set('x-permissions', 'NEWS');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      included: [{ id: 'story-1', title: 'Saved story', summaryStatus: 'PENDING' }],
      excluded: [],
      progress: { total: 1, pending: 1 },
    });
  });

  it('protects automatic feed sync with NEWS permission', async () => {
    const response = await request(buildApp()).post('/api/news/sync').set('x-permissions', 'BILLS_CONTROL');
    expect(response.status).toBe(403);
    expect(fakePrisma.newsItem.createMany).not.toHaveBeenCalled();
  });

  it('returns readable original article text only when requested by an authorized user', async () => {
    const articleHtml = `<html><body><article><h1>Story</h1><p>${'The full story includes details, context, and reported consequences for readers. '.repeat(20)}</p></article></body></html>`;
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(articleHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })));
    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({
      link: 'https://www.infomoney.com.br/story-1/',
      isIncluded: true,
      description: 'Original text from the RSS feed.',
    });
    const response = await request(buildApp()).get('/api/news/story-1/original-text').set('x-permissions', 'NEWS');
    expect(response.status).toBe(200);
    expect(response.body.source).toBe('FULL_ARTICLE');
    expect(response.body.text).toContain('full story includes details');
    expect(fakePrisma.newsItem.findUnique).toHaveBeenCalledWith({
      where: { id: 'story-1' },
      select: { link: true, description: true, isIncluded: true },
    });
    expect(fakePrisma.newsItem.update).not.toHaveBeenCalled();
  });

  it('falls back to saved RSS text when an article cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 403 })));
    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({
      link: 'https://www.infomoney.com.br/story-1/',
      isIncluded: true,
      description: 'RSS description fallback.',
    });
    const response = await request(buildApp()).get('/api/news/story-1/original-text').set('x-permissions', 'NEWS');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'RSS description fallback.', source: 'RSS_ONLY' });
  });

  it('does not return article text for excluded stories', async () => {
    fakePrisma.newsItem.findUnique.mockResolvedValueOnce({ isIncluded: false, description: 'Hidden text.' });
    const response = await request(buildApp()).get('/api/news/story-2/original-text').set('x-permissions', 'NEWS');
    expect(response.status).toBe(404);
  });
});
