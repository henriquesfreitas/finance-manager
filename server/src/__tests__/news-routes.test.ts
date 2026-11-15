import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import { createNewsRouter } from '../routes/news-routes.js';

function buildApp(): Application {
  const app = express();
  app.use('/api', createNewsRouter());
  return app;
}

const FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>InfoMoney</title><atom:link href="https://www.infomoney.com.br/feed/" rel="self" type="application/rss+xml" /><lastBuildDate>Thu, 12 Nov 2026 01:00:52 +0000</lastBuildDate><item><title>Removed</title><link>https://example.com/removed</link><category><![CDATA[Loterias]]></category></item><item><title>Kept</title><link>https://example.com/kept</link><category><![CDATA[Mercados]]></category></item></channel></rss>`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/news/feed', () => {
  it('returns the filtered feed as RSS without requiring authentication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED, { status: 200 })));
    const app = buildApp();

    const response = await request(app).get('/api/news/feed');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/rss+xml');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain('Kept');
    expect(response.text).not.toContain('Removed');
  });

  it('points the atom:link rel="self" at this server instead of the upstream feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED, { status: 200 })));
    const app = buildApp();

    const response = await request(app)
      .get('/api/news/feed')
      .set('Host', 'myfinancemanager.duckdns.org');

    expect(response.text).toContain('href="http://myfinancemanager.duckdns.org/api/news/feed"');
    expect(response.text).not.toContain('infomoney.com.br/feed/');
  });
});

describe('GET /api/news', () => {
  it('returns included and excluded stories plus the active filter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED, { status: 200 })));
    const app = buildApp();

    const response = await request(app).get('/api/news');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      title: 'InfoMoney',
      filter: ['Esportes', 'Loterias', 'Consumo', 'Comsumo', 'Day Trade'],
      included: [{ title: 'Kept', categories: ['Mercados'] }],
      excluded: [{ title: 'Removed', matchedCategories: ['Loterias'] }],
    });
    expect(response.body.xml).toContain('Kept');
    expect(response.body.xml).not.toContain('Removed');
  });

  it('returns 502 when the upstream feed cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 503 })));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = buildApp();

    const response = await request(app).get('/api/news');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'Unable to load the news feed' });
    expect(errorLog).toHaveBeenCalledOnce();
  });
});
