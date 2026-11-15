import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  classifyNewsFeed,
  FEED_DESCRIPTION,
  FEED_TITLE,
  filterFeedXml,
  getClassifiedNewsFeed,
  getFilteredNewsFeed,
  normalizeCategory,
  rebrandFeedChannel,
  rewriteChannelSelfLink,
} from '../services/news-feed-service.js';

const IDENTITY = {
  selfUrl: 'https://example.com/news/feed',
  siteUrl: 'https://example.com/',
};

function item(
  title: string,
  categories: string[],
  options: { link?: string; description?: string } = {},
): string {
  const link = options.link ?? `https://example.com/${encodeURIComponent(title)}`;
  const categoryXml = categories
    .map((category) => `<category><![CDATA[${category}]]></category>`)
    .join('');
  return `<item><title>${title}</title><link>${link}</link><pubDate>Thu, 12 Nov 2026 00:37:24 +0000</pubDate>${categoryXml}<guid isPermaLink="false">${link}</guid><description><![CDATA[<p>${options.description ?? 'Summary text'}</p>]]></description></item>`;
}

function rss(...items: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>InfoMoney</title><lastBuildDate>Thu, 12 Nov 2026 01:00:52 +0000</lastBuildDate>${items.join('')}</channel></rss>`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('normalizeCategory', () => {
  it('unwraps CDATA and normalizes casing and whitespace', () => {
    expect(normalizeCategory('<![CDATA[  Day   Trade ]]>')).toBe('day trade');
    expect(normalizeCategory('  ESPORTES  ')).toBe('esportes');
  });

  it('decodes XML entities before comparing', () => {
    expect(normalizeCategory('Consumo &amp; Cia')).toBe('consumo & cia');
  });
});

describe('rewriteChannelSelfLink', () => {
  const xmlWithSelfLink =
    '<rss version="2.0"><channel><atom:link href="https://www.infomoney.com.br/feed/" rel="self" type="application/rss+xml" /><title>InfoMoney</title></channel></rss>';

  it('replaces the href of the channel atom:link rel="self"', () => {
    const rewritten = rewriteChannelSelfLink(xmlWithSelfLink, 'https://example.com/api/news/feed');

    expect(rewritten).toContain('href="https://example.com/api/news/feed"');
    expect(rewritten).toContain('rel="self"');
    expect(rewritten).toContain('type="application/rss+xml"');
    expect(rewritten).not.toContain('infomoney.com.br');
  });

  it('escapes XML-sensitive characters in the self URL', () => {
    const rewritten = rewriteChannelSelfLink(xmlWithSelfLink, 'https://example.com/feed?a=1&b=2');

    expect(rewritten).toContain('href="https://example.com/feed?a=1&amp;b=2"');
  });

  it('leaves the document untouched when there is no self link', () => {
    const xml = '<rss version="2.0"><channel><title>InfoMoney</title></channel></rss>';

    expect(rewriteChannelSelfLink(xml, 'https://example.com/api/news/feed')).toBe(xml);
  });
});

describe('rebrandFeedChannel', () => {
  const xml = `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>InfoMoney</title><link>https://www.infomoney.com.br/</link><description>Notícias, ações e muito mais.</description><atom:link href="https://www.infomoney.com.br/feed/" rel="self" type="application/rss+xml" /><lastBuildDate>Thu, 12 Nov 2026 01:00:52 +0000</lastBuildDate><language>pt-BR</language><generator>https://wordpress.org/?v=6.9.11</generator><image><url>https://www.infomoney.com.br/favicon.png</url><title>InfoMoney</title><link>https://www.infomoney.com.br/</link></image><site xmlns="com-wordpress:feed-additions:1">161989173</site><item><title>Kept</title><link>https://www.infomoney.com.br/article/</link><guid isPermaLink="false">guid-1</guid><pubDate>Thu, 12 Nov 2026 00:37:24 +0000</pubDate></item></channel></rss>`;

  it('replaces the channel identity and removes upstream-only metadata', () => {
    const rebranded = rebrandFeedChannel(xml, IDENTITY);

    expect(rebranded).toContain(`<title>${FEED_TITLE}</title>`);
    expect(rebranded).toContain(`<description>${FEED_DESCRIPTION}</description>`);
    expect(rebranded).toContain('<link>https://example.com/</link>');
    expect(rebranded).toContain('href="https://example.com/news/feed"');
    expect(rebranded).toContain('<language>pt-BR</language>');
    expect(rebranded).toContain('<lastBuildDate>Thu, 12 Nov 2026 01:00:52 +0000</lastBuildDate>');
    // Item article links keep pointing at the upstream site by design; only
    // the channel head must stop referencing it.
    const channelHead = rebranded.slice(0, rebranded.search(/<item\b/i));
    expect(channelHead).not.toContain('infomoney');
    expect(channelHead).not.toContain('<generator>');
    expect(channelHead).not.toContain('<image>');
    expect(channelHead).not.toContain('com-wordpress');
  });

  it('keeps item titles, links, and dates untouched', () => {
    const rebranded = rebrandFeedChannel(xml, IDENTITY);

    expect(rebranded).toContain('<item><title>Kept</title><link>https://www.infomoney.com.br/article/</link>');
    expect(rebranded).toContain('<pubDate>Thu, 12 Nov 2026 00:37:24 +0000</pubDate>');
  });

  it('escapes XML-sensitive characters in the replacement values', () => {
    const plain =
      '<rss version="2.0"><channel><title>InfoMoney</title><link>https://www.infomoney.com.br/</link><description>Old description</description></channel></rss>';
    const rebranded = rebrandFeedChannel(plain, {
      selfUrl: 'https://example.com/feed?a=1&b=2',
      siteUrl: 'https://example.com/?a=1&b=2',
    });

    expect(rebranded).toContain('<link>https://example.com/?a=1&amp;b=2</link>');
  });
});

describe('filterFeedXml', () => {
  it('removes items in the excluded categories and keeps everything else', () => {
    const xml = rss(
      item('Lottery result', ['Loterias']),
      item('Sports roundup', ['esportes']),
      item('Shopping tips', ['Consumo']),
      item('Day trading guide', ['Day Trade']),
      item('Market outlook', ['Mercados', 'Investimentos']),
    );

    const filtered = filterFeedXml(xml);

    expect(filtered).not.toContain('Lottery result');
    expect(filtered).not.toContain('Sports roundup');
    expect(filtered).not.toContain('Shopping tips');
    expect(filtered).not.toContain('Day trading guide');
    expect(filtered).toContain('Market outlook');
    expect(filtered).toContain('<title>InfoMoney</title>');
    expect(filtered).toContain('<rss version="2.0">');
  });

  it('also matches the "Comsumo" spelling from the request', () => {
    const xml = rss(item('Shopping news', ['comsumo']), item('Kept news', ['Economia']));

    const filtered = filterFeedXml(xml);

    expect(filtered).not.toContain('Shopping news');
    expect(filtered).toContain('Kept news');
  });

  it('does not remove items whose category merely contains an excluded word', () => {
    const xml = rss(item('Consumption habits', ['Consumo consciente']));

    expect(filterFeedXml(xml)).toContain('Consumption habits');
  });
});

describe('classifyNewsFeed', () => {
  it('splits included and excluded stories and reports the matched categories', () => {
    const xml = rss(
      item('Lottery result', ['Loterias', 'Caixa']),
      item('Sports roundup', ['esportes']),
      item('Market outlook', ['Mercados'], { description: 'Markets closed higher.' }),
    );

    const result = classifyNewsFeed(xml);

    expect(result.title).toBe('InfoMoney');
    expect(result.lastBuildDate).toBe('Thu, 12 Nov 2026 01:00:52 +0000');
    expect(result.filter).toEqual(['Esportes', 'Loterias', 'Consumo', 'Comsumo', 'Day Trade']);

    expect(result.included.map((entry) => entry.title)).toEqual(['Market outlook']);
    expect(result.included[0]?.summary).toBe('Markets closed higher.');

    expect(result.excluded.map((entry) => entry.title)).toEqual([
      'Lottery result',
      'Sports roundup',
    ]);
    expect(result.excluded[0]?.matchedCategories).toEqual(['Loterias']);
    expect(result.excluded[1]?.matchedCategories).toEqual(['esportes']);
  });
});

describe('getClassifiedNewsFeed', () => {
  it('returns the classification and the filtered XML without caching', async () => {
    const xml = rss(item('Removed', ['Loterias']), item('Kept', ['Mercados']));
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(xml, { status: 200 })));

    const first = await getClassifiedNewsFeed({ fetchImpl: fetchMock }, IDENTITY);

    expect(first.included.map((entry) => entry.title)).toEqual(['Kept']);
    expect(first.excluded.map((entry) => entry.title)).toEqual(['Removed']);
    expect(first.xml).toContain('Kept');
    expect(first.xml).not.toContain('Removed');

    await getClassifiedNewsFeed({ fetchImpl: fetchMock }, IDENTITY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects when the upstream feed responds with an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('nope', { status: 503 }))),
    );

    await expect(getFilteredNewsFeed({}, IDENTITY)).rejects.toThrow('status 503');
    await expect(getClassifiedNewsFeed({}, IDENTITY)).rejects.toThrow('status 503');
  });

  it('rejects when the upstream payload is not an RSS document', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() => Promise.resolve(new Response('<html></html>', { status: 200 }))),
    );

    await expect(getFilteredNewsFeed({}, IDENTITY)).rejects.toThrow('unexpected payload');
    await expect(getClassifiedNewsFeed({}, IDENTITY)).rejects.toThrow('unexpected payload');
  });
});
