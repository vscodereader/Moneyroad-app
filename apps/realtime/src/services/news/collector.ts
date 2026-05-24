import { news, newsSubscription } from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { eq, inArray } from "drizzle-orm";
import { log } from "evlog";

import { summarizeNews } from "./ai";
import { mapWithConcurrency } from "./concurrency";
import { getDb, isNewsDbConfigured } from "./db";
import {
  classifyCategory,
  crawlNaverArticle,
  extractSourceFromUrl,
  extractTags,
  fetchNaverNewsList,
} from "./naver";
import { parseNewsBody, parseNewsTitle } from "./parser";
import { notifyBreakingNews } from "./push";
import { matchStockCode } from "./stock-matcher";
import type { NaverNewsItem, NewsEvent, PreparedNews } from "./types";

const DEFAULT_QUERY = "주식";
const CRAWL_CONCURRENCY = 5;

type OnNews = (event: NewsEvent) => void;

/** Distinct active subscription queries, or the default when none exist. */
async function getQueries(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ query: newsSubscription.query })
    .from(newsSubscription)
    .where(eq(newsSubscription.active, true));
  return rows.length > 0 ? rows.map((r) => r.query) : [DEFAULT_QUERY];
}

/** Filters the fetched batch down to items not already stored (dedup-first). */
async function filterNewItems(
  items: NaverNewsItem[]
): Promise<NaverNewsItem[]> {
  // Drop in-batch duplicates by original link first.
  const byLink = new Map<string, NaverNewsItem>();
  for (const item of items) {
    if (item.originallink) {
      byLink.set(item.originallink, item);
    }
  }
  const links = [...byLink.keys()];
  if (links.length === 0) {
    return [];
  }

  const existing = await getDb()
    .select({ originallink: news.originallink })
    .from(news)
    .where(inArray(news.originallink, links));
  const existingSet = new Set(existing.map((r) => r.originallink));

  return [...byLink.values()].filter(
    (item) => !existingSet.has(item.originallink)
  );
}

/** Enriches a single new item: crawl body, match stock, AI summarize. */
async function prepareItem(
  item: NaverNewsItem,
  query: string
): Promise<PreparedNews> {
  const { source: crawledSource, content } = await crawlNaverArticle(item.link);
  const source = crawledSource ?? extractSourceFromUrl(item.originallink);
  const title = parseNewsTitle(item.title);
  const description = parseNewsBody(item.description);
  const tags = extractTags(title, query);
  const stockCode = await matchStockCode(title, content);

  const ai = await summarizeNews({ title, body: content ?? description });
  const category = ai?.category ?? classifyCategory(query);

  return {
    id: crypto.randomUUID(),
    originallink: item.originallink,
    title,
    link: item.link,
    description,
    pubDate: new Date(item.pubDate),
    query,
    source,
    content,
    tags,
    category,
    stockCode,
    summary: ai?.summary ?? null,
    sourceType: "auto",
  };
}

function toEvent(row: {
  id: string;
  title: string;
  description: string;
  summary: string | null;
  link: string | null;
  source: string | null;
  category: string | null;
  tags: string[] | null;
  stockCode: string | null;
  query: string | null;
  pubDate: Date;
  createdAt: Date;
}): NewsEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    summary: row.summary,
    link: row.link,
    source: row.source,
    category: row.category,
    tags: row.tags,
    stockCode: row.stockCode,
    query: row.query,
    pubDate: row.pubDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

async function collectQuery(
  query: string,
  clientId: string,
  clientSecret: string,
  onNews: OnNews
): Promise<{ fetchedCount: number; insertedCount: number }> {
  const items = await fetchNaverNewsList(query, clientId, clientSecret);
  const newItems = await filterNewItems(items);
  if (newItems.length === 0) {
    return { fetchedCount: items.length, insertedCount: 0 };
  }

  const prepared = await mapWithConcurrency(
    newItems,
    CRAWL_CONCURRENCY,
    (item) => prepareItem(item, query)
  );

  const inserted = await getDb()
    .insert(news)
    .values(prepared)
    .onConflictDoNothing({ target: news.originallink })
    .returning({
      id: news.id,
      title: news.title,
      description: news.description,
      summary: news.summary,
      link: news.link,
      source: news.source,
      category: news.category,
      tags: news.tags,
      stockCode: news.stockCode,
      query: news.query,
      pubDate: news.pubDate,
      createdAt: news.createdAt,
    });

  for (const row of inserted) {
    onNews(toEvent(row));
    // Fire-and-forget: errors are logged inside notifyBreakingNews.
    notifyBreakingNews({
      id: row.id,
      title: row.title,
      description: row.description,
      stockCode: row.stockCode,
    }).catch(() => {
      // already logged
    });
  }

  return { fetchedCount: items.length, insertedCount: inserted.length };
}

let collecting = false;

/** Runs one collection pass across all active subscription queries. */
export async function collectNews(onNews: OnNews): Promise<{
  fetchedCount: number;
  insertedCount: number;
  queryCount: number;
}> {
  const empty = { fetchedCount: 0, insertedCount: 0, queryCount: 0 };
  if (collecting) {
    return empty;
  }
  if (
    !(isNewsDbConfigured() && env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET)
  ) {
    return empty;
  }

  collecting = true;
  try {
    const queries = await getQueries();
    const clientId = env.NAVER_CLIENT_ID;
    const clientSecret = env.NAVER_CLIENT_SECRET;
    let fetchedCount = 0;
    let insertedCount = 0;
    for (const query of queries) {
      const result = await collectQuery(query, clientId, clientSecret, onNews);
      fetchedCount += result.fetchedCount;
      insertedCount += result.insertedCount;
    }
    return { fetchedCount, insertedCount, queryCount: queries.length };
  } finally {
    collecting = false;
  }
}

let timer: NodeJS.Timeout | null = null;

/** Whether the collector can run with the current env (db + Naver keys). */
export function isCollectorEnabled(): boolean {
  return Boolean(
    isNewsDbConfigured() && env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET
  );
}

/** Starts the polling loop (runs once immediately). No-op when disabled. */
export function startCollector(onNews: OnNews): void {
  if (timer || !isCollectorEnabled()) {
    return;
  }
  const run = () => {
    collectNews(onNews)
      .then((result) => {
        if (result.insertedCount > 0) {
          log.info({ news: { event: "collected", ...result } });
        }
      })
      .catch((err) => {
        log.error({ err, news: { event: "collect_failed" } });
      });
  };
  timer = setInterval(run, env.NEWS_FETCH_INTERVAL_MS);
  run(); // run immediately
}

export function stopCollector(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
