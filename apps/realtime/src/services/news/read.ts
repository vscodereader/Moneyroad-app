import { news } from "@moneyroad-app/db/schema";
import { and, desc, eq, type SQL } from "drizzle-orm";

import { getDb } from "./db";
import type { NewsEvent } from "./types";

interface RecentNewsOptions {
  category?: string;
  limit?: number;
  stockCode?: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

/** Recent news for the REST endpoint, newest first, with optional filters. */
export async function getRecentNews(
  opts: RecentNewsOptions = {}
): Promise<NewsEvent[]> {
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const filters: SQL[] = [];
  if (opts.category) {
    filters.push(eq(news.category, opts.category));
  }
  if (opts.stockCode) {
    filters.push(eq(news.stockCode, opts.stockCode));
  }

  const rows = await getDb()
    .select({
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
    })
    .from(news)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(news.pubDate))
    .limit(limit);

  return rows.map((row) => ({
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
  }));
}
