import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type Application } from 'express';
import { createNewsRouter } from '../routes/news-routes.js';

function buildApp(): Application {
  const app = express();
  app.use(createNewsRouter());
  return app;
}

const FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>InfoMoney</title><link>https://www.infomoney.com.br/</link><description>Notícias do InfoMoney.</description><atom:link href="https://www.infomoney.com.br/feed/" rel="self" type="application/rss+xml" /><lastBuildDate>Thu, 12 Nov 2026 01:00:52 +0000</lastBuildDate><generator>https://wordpress.org/?v=6.9.11</generator><image><url>https://www.infomoney.com.br/favicon.png</url><title>InfoMoney</title></image><site xmlns="com-wordpress:feed-additions:1">161989173</site><item><title>Removed</title><link>https://example.com/removed</link><category><![CDATA[Loterias]]></category></item><item><title>Kept</title><link>https://example.com/kept</link><category><![CDATA[Mercados]]></category></item></channel></rss>`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /news/feed', () => {
  it('returns the filtered, rebranded feed as RSS without requiring authentication', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED, { status: 200 })));
    const app = buildApp();

    const response = await request(app)
      .get('/news/feed')
      .set('Host', 'myfinancemanager.duckdns.org');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/rss+xml');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain('Kept');
    expect(response.text).not.toContain('Removed');
  });

  it('rebrands the channel head so it no longer identifies as the upstream feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED, { status: 200 })));
    const app = buildApp();

    const response = await request(app)
      .get('/news/feed')
      .set('Host', 'myfinancemanager.duckdns.org');

    expect(response.text).toContain('<title>Finance Manager News</title>');
    expect(response.text).toContain('<link>http://myfinancemanager.duckdns.org/</link>');
    expect(response.text).toContain(
      'href="http://myfinancemanager.duckdns.org/news/feed" rel="self"',
    );
    expect(response.text).not.toContain('infomoney');
    expect(response.text).not.toContain('<generator>');
    expect(response.text).not.toContain('<image>');
    expect(response.text).not.toContain('com-wordpress');
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
      title: 'Finance Manager News',
      filter: ['Esportes', 'Loterias', 'Consumo', 'Comsumo', 'Day Trade'],
      included: [{ title: 'Kept', categories: ['Mercados'] }],
      excluded: [{ title: 'Removed', matchedCategories: ['Loterias'] }],
    });
    expect(response.body.xml).toContain('Kept');
    expect(response.body.xml).not.toContain('Removed');
    expect(response.body.xml).toContain('<title>Finance Manager News</title>');
    expect(response.body.xml).not.toContain('infomoney');
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
