import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNewsFeed } from '../services/news-api-client';

const PAYLOAD = {
  title: 'InfoMoney',
  lastBuildDate: 'Thu, 12 Nov 2026 01:00:52 +0000',
  filter: ['Esportes', 'Loterias', 'Consumo', 'Comsumo', 'Day Trade'],
  included: [
    {
      id: '1',
      title: 'Market outlook',
      link: 'https://example.com/market',
      publishedAt: null,
      categories: ['Mercados'],
      summary: 'Markets rose.',
    },
  ],
  excluded: [
    {
      id: '2',
      title: 'Lottery result',
      link: 'https://example.com/lottery',
      publishedAt: null,
      categories: ['Loterias'],
      summary: 'Numbers.',
      matchedCategories: ['Loterias'],
    },
  ],
  xml: '<rss><channel><title>InfoMoney</title></channel></rss>',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNewsFeed', () => {
  it('requests the public classification endpoint and returns both lists', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(PAYLOAD), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchNewsFeed()).resolves.toEqual(PAYLOAD);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/api\/news$/);
  });

  it('uses the server error message when the feed cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unable to load the news feed' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(fetchNewsFeed()).rejects.toThrow('Unable to load the news feed');
  });
});
