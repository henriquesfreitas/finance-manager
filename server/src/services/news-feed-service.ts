/**
 * Fetches the public InfoMoney RSS feed, classifies every story against the
 * active category filter, and can return either structured data for the /news
 * page or the same feed XML with the excluded items removed.
 *
 * Nothing is persisted: every request reads the feed as it currently exists.
 */

export const NEWS_FEED_URL = 'https://www.infomoney.com.br/feed/';

/**
 * Category names excluded from the filtered feed, compared case-insensitively.
 * "Comsumo" is kept alongside "Consumo" because the request mentioned the
 * former spelling, which is likely a typo for the feed's real category.
 */
export const EXCLUDED_CATEGORIES: readonly string[] = [
  'Esportes',
  'Loterias',
  'Consumo',
  'Comsumo',
  'Day Trade',
];

const ITEM_PATTERN = /<item\b[^>]*>[\s\S]*?<\/item>/gi;
const ITEM_START_PATTERN = /<item\b/i;
const CATEGORY_PATTERN = /<category\b[^>]*>([\s\S]*?)<\/category>/gi;
const DESCRIPTION_BLOCK_PATTERN = /<description\b[^>]*>[\s\S]*?<\/description>/i;
const CDATA_PATTERN = /^<!\[CDATA\[([\s\S]*?)\]\]>$/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

export interface NewsFeedItem {
  id: string;
  title: string;
  link: string;
  publishedAt: string | null;
  categories: string[];
  summary: string;
}

export interface ExcludedNewsFeedItem extends NewsFeedItem {
  /** Feed categories that matched the active filter. */
  matchedCategories: string[];
}

export interface ClassifiedNewsFeed {
  title: string;
  lastBuildDate: string | null;
  filter: string[];
  included: NewsFeedItem[];
  excluded: ExcludedNewsFeedItem[];
}

export interface NewsFeedResponse extends ClassifiedNewsFeed {
  /** The filtered RSS document served by /api/news/feed. */
  xml: string;
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function unwrapCdata(value: string): string {
  const cdataMatch = CDATA_PATTERN.exec(value.trim());
  return cdataMatch?.[1] ?? value;
}

/** Normalizes a `<category>` payload (CDATA, entities, casing, whitespace). */
export function normalizeCategory(raw: string): string {
  return decodeXmlEntities(unwrapCdata(raw)).replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Reads and decodes the text of the first matching tag, or null if absent. */
function tagText(xml: string, tag: string): string | null {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = pattern.exec(xml);
  return match ? decodeXmlEntities(unwrapCdata(match[1] ?? '')).trim() : null;
}

function safeHttpLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Feed categories with their original display text (metadata only). */
function itemCategories(itemXml: string): string[] {
  const metadataXml = itemXml.replace(DESCRIPTION_BLOCK_PATTERN, '');
  return Array.from(metadataXml.matchAll(CATEGORY_PATTERN))
    .map((match) =>
      decodeXmlEntities(unwrapCdata(match[1] ?? ''))
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean);
}

function matchedCategories(itemXml: string, excluded: ReadonlySet<string>): string[] {
  return itemCategories(itemXml).filter((category) => excluded.has(normalizeCategory(category)));
}

function htmlToText(html: string): string {
  if (!html) return '';
  return decodeXmlEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/The post .+? appeared first on .+?\./i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFeedItem(itemXml: string): NewsFeedItem | null {
  const metadataXml = itemXml.replace(DESCRIPTION_BLOCK_PATTERN, '');
  const title = tagText(metadataXml, 'title');
  const link = safeHttpLink(tagText(metadataXml, 'link'));
  if (!title || !link) return null;

  return {
    id: tagText(metadataXml, 'guid') ?? link,
    title,
    link,
    publishedAt: tagText(metadataXml, 'pubDate'),
    categories: itemCategories(itemXml),
    summary: htmlToText(tagText(itemXml, 'description') ?? ''),
  };
}

/**
 * Removes every `<item>` whose categories include one of `excluded`.
 * Everything else in the document is returned untouched.
 */
export function filterFeedXml(
  xml: string,
  excluded: readonly string[] = EXCLUDED_CATEGORIES,
): string {
  const excludedSet = new Set(excluded.map((category) => normalizeCategory(category)));
  return xml.replace(ITEM_PATTERN, (itemXml) =>
    matchedCategories(itemXml, excludedSet).length > 0 ? '' : itemXml,
  );
}

/** Splits every item in the feed into included and excluded lists. */
export function classifyNewsFeed(
  xml: string,
  excluded: readonly string[] = EXCLUDED_CATEGORIES,
): ClassifiedNewsFeed {
  const excludedSet = new Set(excluded.map((category) => normalizeCategory(category)));
  const firstItemIndex = xml.search(ITEM_START_PATTERN);
  const channelXml = firstItemIndex >= 0 ? xml.slice(0, firstItemIndex) : xml;

  const included: NewsFeedItem[] = [];
  const excludedItems: ExcludedNewsFeedItem[] = [];

  for (const match of xml.matchAll(ITEM_PATTERN)) {
    const itemXml = match[0];
    const item = toFeedItem(itemXml);
    if (!item) continue;

    const matched = matchedCategories(itemXml, excludedSet);
    if (matched.length > 0) {
      excludedItems.push({ ...item, matchedCategories: matched });
    } else {
      included.push(item);
    }
  }

  return {
    title: tagText(channelXml, 'title') ?? 'InfoMoney',
    lastBuildDate: tagText(channelXml, 'lastBuildDate'),
    filter: [...excluded],
    included,
    excluded: excludedItems,
  };
}

export interface GetNewsFeedOptions {
  /** Injectable fetch implementation for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

async function fetchOriginalNewsFeed(fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(NEWS_FEED_URL, {
    headers: {
      Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`News feed request failed with status ${String(response.status)}`);
  }

  const xml = await response.text();
  if (!xml.includes('<rss') || !xml.includes('<channel')) {
    throw new Error('News feed returned an unexpected payload');
  }

  return xml;
}

/** Returns the filtered RSS document without caching. */
export async function getFilteredNewsFeed(options: GetNewsFeedOptions = {}): Promise<string> {
  return filterFeedXml(await fetchOriginalNewsFeed(options.fetchImpl));
}

/** Returns included/excluded stories, the active filter, and the filtered XML. */
export async function getClassifiedNewsFeed(
  options: GetNewsFeedOptions = {},
): Promise<NewsFeedResponse> {
  const xml = await fetchOriginalNewsFeed(options.fetchImpl);
  return {
    ...classifyNewsFeed(xml),
    xml: filterFeedXml(xml),
  };
}
