/**
 * Actor News Fetcher — dual-source misconduct intelligence
 *
 * Source A (local): Google News RSS — full coverage of Nevada local outlets
 *   rgj.com, nevadaindependent.com, nevadacurrent.com, krnv.com, ktvn.com, 8newsnow.com
 *
 * Source B (national): NewsAPI.org — broader coverage, AP wire, national legal press
 *
 * Results are scored, deduped, and stored in actor_news_cache.
 * Cache TTL: 6 hours. Admin can force-refresh per actor.
 */

import { getDb } from "./db";
import { actorNewsCache } from "../drizzle/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const NEWS_API_KEY = process.env.NEWS_API_KEY ?? "";

/** Local Nevada outlets to prioritize in Google News RSS */
const LOCAL_DOMAINS = [
  "rgj.com",
  "nevadaindependent.com",
  "nevadacurrent.com",
  "krnv.com",
  "ktvn.com",
  "8newsnow.com",
  "kolotv.com",
  "mynews4.com",
  "renonews.com",
  "washoecounty.gov",
];

/** Keywords that elevate relevance score and set misconductFlag */
const MISCONDUCT_KEYWORDS = [
  "misconduct",
  "complaint",
  "discipline",
  "disbarred",
  "suspension",
  "sanction",
  "censure",
  "reprimand",
  "investigation",
  "fired",
  "removed",
  "recused",
  "disqualified",
  "bar complaint",
  "ethics violation",
  "due process",
  "civil rights",
  "lawsuit",
  "sued",
  "wrongful",
  "appeal",
  "reversed",
  "overturned",
];

interface RawNewsItem {
  headline: string;
  url: string;
  source: string;
  sourceTier: "local" | "national";
  publishedAt: Date | null;
  snippet: string;
}

/** Parse Google News RSS XML into raw items */
function parseGoogleNewsRss(xml: string, actorName: string): RawNewsItem[] {
  const items: RawNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (/<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(block) ??
      /<title>(.*?)<\/title>/.exec(block))?.[1]?.trim() ?? "";
    const link = (/<link>(.*?)<\/link>/.exec(block) ??
      /<guid[^>]*>(.*?)<\/guid>/.exec(block))?.[1]?.trim() ?? "";
    const pubDate = (/<pubDate>(.*?)<\/pubDate>/.exec(block))?.[1]?.trim() ?? "";
    const description = (/<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(block) ??
      /<description>(.*?)<\/description>/.exec(block))?.[1]
      ?.replace(/<[^>]+>/g, "")
      .trim() ?? "";
    const sourceName = (/<source[^>]*>(.*?)<\/source>/.exec(block))?.[1]?.trim() ?? "Google News";

    if (!title || !link) continue;

    // Determine if this is a local outlet
    const isLocal = LOCAL_DOMAINS.some((d) => link.includes(d) || sourceName.toLowerCase().includes(d.split(".")[0]));

    items.push({
      headline: title,
      url: link,
      source: sourceName,
      sourceTier: isLocal ? "local" : "national",
      publishedAt: pubDate ? new Date(pubDate) : null,
      snippet: description.slice(0, 500),
    });
  }

  return items;
}

/** Fetch Google News RSS for an actor name */
async function fetchGoogleNewsRss(actorName: string, extraTerms = ""): Promise<RawNewsItem[]> {
  const query = encodeURIComponent(`"${actorName}" ${extraTerms} Nevada`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RenoRecord/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseGoogleNewsRss(xml, actorName);
  } catch {
    return [];
  }
}

/** Fetch NewsAPI for an actor name */
async function fetchNewsApi(actorName: string): Promise<RawNewsItem[]> {
  if (!NEWS_API_KEY) return [];

  const query = encodeURIComponent(`"${actorName}" Nevada`);
  const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_API_KEY}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      status: string;
      articles?: Array<{
        title: string;
        url: string;
        source: { name: string };
        publishedAt: string;
        description: string | null;
      }>;
    };
    if (data.status !== "ok" || !data.articles) return [];

    return data.articles.map((a) => ({
      headline: a.title,
      url: a.url,
      source: a.source.name,
      sourceTier: LOCAL_DOMAINS.some((d) => a.url.includes(d)) ? "local" : "national",
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
      snippet: (a.description ?? "").slice(0, 500),
    }));
  } catch {
    return [];
  }
}

/** Score a news item for relevance and detect misconduct keywords */
function scoreItem(item: RawNewsItem, actorName: string): { score: number; misconductFlag: boolean } {
  const text = `${item.headline} ${item.snippet}`.toLowerCase();
  const nameParts = actorName.toLowerCase().split(" ");

  let score = 50;

  // Boost for local outlet
  if (item.sourceTier === "local") score += 20;

  // Boost for exact name match in headline
  if (item.headline.toLowerCase().includes(actorName.toLowerCase())) score += 15;

  // Boost for partial name match
  const nameMatchCount = nameParts.filter((p) => p.length > 2 && text.includes(p)).length;
  score += nameMatchCount * 5;

  // Misconduct keyword detection
  const misconductMatches = MISCONDUCT_KEYWORDS.filter((kw) => text.includes(kw));
  const misconductFlag = misconductMatches.length > 0;
  if (misconductFlag) score += misconductMatches.length * 8;

  return { score: Math.min(100, score), misconductFlag };
}

/** Deduplicate items by URL */
function dedup(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

/** Cache TTL in ms (6 hours) */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Check if the cache for an actor is still fresh */
export async function isCacheFresh(actorId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const cutoff = new Date(Date.now() - CACHE_TTL_MS);
  const [row] = await db
    .select({ fetchedAt: actorNewsCache.fetchedAt })
    .from(actorNewsCache)
    .where(and(eq(actorNewsCache.actorId, actorId), gte(actorNewsCache.fetchedAt, cutoff)))
    .limit(1);
  return !!row;
}

/** Fetch, score, and cache news for a single actor. Returns inserted count. */
export async function refreshActorNews(actorId: number, actorName: string, forceRefresh = false): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // Check cache freshness unless forced
  if (!forceRefresh && (await isCacheFresh(actorId))) {
    return 0; // cache still fresh, nothing to do
  }

  // Fetch from both sources in parallel
  const [rssGeneral, rssMisconduct, newsApiItems] = await Promise.all([
    fetchGoogleNewsRss(actorName, "court"),
    fetchGoogleNewsRss(actorName, "misconduct complaint discipline"),
    fetchNewsApi(actorName),
  ]);

  const allRaw = dedup([...rssGeneral, ...rssMisconduct, ...newsApiItems]);

  if (allRaw.length === 0) return 0;

  // Score and filter — only keep items with score >= 40
  const scored = allRaw
    .map((item) => ({ ...item, ...scoreItem(item, actorName) }))
    .filter((item) => item.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50); // cap at 50 items per actor

  if (scored.length === 0) return 0;

  // Delete old cache for this actor
  await db.delete(actorNewsCache).where(eq(actorNewsCache.actorId, actorId));

  // Insert new items
  await db.insert(actorNewsCache).values(
    scored.map((item) => ({
      actorId,
      headline: item.headline,
      url: item.url,
      source: item.source,
      sourceTier: item.sourceTier,
      publishedAt: item.publishedAt,
      snippet: item.snippet ?? null,
      relevanceScore: item.score,
      misconductFlag: item.misconductFlag,
    })),
  );

  return scored.length;
}

/** Get cached news for an actor (auto-refresh if stale) */
export async function getActorNews(actorId: number, actorName: string): Promise<typeof actorNewsCache.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  // Auto-refresh if stale
  await refreshActorNews(actorId, actorName, false);

  return db
    .select()
    .from(actorNewsCache)
    .where(eq(actorNewsCache.actorId, actorId))
    .orderBy(desc(actorNewsCache.relevanceScore), desc(actorNewsCache.publishedAt))
    .limit(30);
}
