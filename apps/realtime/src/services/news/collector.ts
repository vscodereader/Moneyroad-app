import { news, newsSubscription } from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { eq, inArray } from "drizzle-orm";
import { log } from "evlog";

import { classifyNewsBatch } from "./ai";
import { mapWithConcurrency } from "./concurrency";
import { getDb, isNewsDbConfigured } from "./db";
import {
  classifyArticle,
  crawlNaverArticle,
  extractSourceFromUrl,
  extractTags,
  fetchNaverNewsList,
  isRelevant,
  pickPrimary,
} from "./naver";
import { parseNewsBody, parseNewsTitle } from "./parser";
import { notifyBreakingNews } from "./push";
import { matchStockCode } from "./stock-matcher";
import type { NaverNewsItem, NewsEvent, PreparedNews } from "./types";

/* ----(기본 검색어 목록 확장: 시작)---- */
// 구독이 없을 때(또는 항상) 기본으로 도는 검색어들. 검색어마다 최신 20개 창을
// 따로 긁으므로 커버리지가 곱으로 넓어진다. 자유롭게 더하거나 뺄 수 있음.
const DEFAULT_QUERIES = [
  "주식",
  "코스피",
  "코스닥",
  "증시",
  "반도체",
  "2차전지",
  "바이오",
];
/* ----(기본 검색어 목록 확장: 끝)---- */
const CRAWL_CONCURRENCY = 5;
/* ----(뉴스 AI 배치 분류 적용: 시작)---- */
// AI 분류 배치 크기 — 요청 1번에 이 개수만큼 묶어 라벨을 받는다(호출 수 1/10).
const AI_BATCH_SIZE = 10;
/* ----(뉴스 AI 배치 분류 적용: 끝)---- */

/* ----(검색어당 가져올 기사 수: 시작)---- */
// 검색어당 한 번에 가져올 최신 기사 수 (네이버 max 100).
const FETCH_DISPLAY = 30;
/* ----(검색어당 가져올 기사 수: 끝)---- */

type OnNews = (event: NewsEvent) => void;

/** Distinct active subscription queries, or the default when none exist. */
async function getQueries(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ query: newsSubscription.query })
    .from(newsSubscription)
    .where(eq(newsSubscription.active, true));
  const subs = rows.map((r) => r.query);
  // ----(변경: 기본 검색어를 항상 포함 + 활성 구독 검색어 합침, 중복 제거)----
  return [...new Set([...DEFAULT_QUERIES, ...subs])];
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

/**
 * Enriches a single new item: crawl body, match stock, classify. Returns null
 * when the article is not stock-relevant (dropped before insert).
 */
async function prepareItem(
  item: NaverNewsItem,
  query: string
): Promise<PreparedNews | null> {
  const { source: crawledSource, content } = await crawlNaverArticle(item.link);
  const source = crawledSource ?? extractSourceFromUrl(item.originallink);
  const title = parseNewsTitle(item.title);
  const description = parseNewsBody(item.description);
  const stockCode = await matchStockCode(title, content);

  // Relevance gate: drop articles with no stock/finance signal (e.g. an
  // unrelated story that only matched "주식" inside "주식회사").
  if (!isRelevant({ title, description, content, stockCode })) {
    return null;
  }

  const tags = extractTags(title, query);
  // Rule-based category is the FALLBACK; the AI batch classifier (applied in
  // collectQuery) overrides it and drops noise when the AI call succeeds.
  // Classify by the article's own text (title + body), not the search query.
  const { scores } = classifyArticle({
    title,
    description,
    content,
    stockCode,
  });
  const category = pickPrimary(scores);

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
    // 요약 기능 제거: summary는 더 이상 생성하지 않는다(라벨만).
    summary: null,
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

/* ----(뉴스 AI 배치 분류 적용 헬퍼: 시작)---- */
// prepared 행들을 AI 배치 분류기에 넣어: 각 행의 category를 AI 라벨로 덮어쓰고,
// AI가 "none"(증시 무관)으로 본 행은 버린다(= 관련성 게이트). AI 호출이 실패하면
// 각 행의 규칙기반 category를 그대로 둔다(기존 폴백 동작 재사용).
async function applyAiCategories(
  rows: PreparedNews[]
): Promise<PreparedNews[]> {
  const out: PreparedNews[] = [];
  for (let start = 0; start < rows.length; start += AI_BATCH_SIZE) {
    const chunk = rows.slice(start, start + AI_BATCH_SIZE);
    const labels = await classifyNewsBatch(
      chunk.map((r) => ({ title: r.title, body: r.content ?? r.description }))
    );
    for (const [j, row] of chunk.entries()) {
      if (labels === null) {
        // AI 미설정/실패 → 규칙 category가 있을 때만 유지, 미분류(null)면 제외.
        if (row.category !== null) {
          out.push(row);
        }
        continue;
      }
      const label = labels[j];
      if (label) {
        out.push({ ...row, category: label });
      }
      // label이 null/undefined → AI가 증시 무관으로 판단 → 제외(push 안 함).
    }
  }
  return out;
}
/* ----(뉴스 AI 배치 분류 적용 헬퍼: 끝)---- */

async function collectQuery(
  query: string,
  clientId: string,
  clientSecret: string,
  onNews: OnNews
): Promise<{ fetchedCount: number; insertedCount: number }> {
  // ----(변경: 검색어당 기사 수를 FETCH_DISPLAY(30)로 명시)----
  const items = await fetchNaverNewsList(
    query,
    clientId,
    clientSecret,
    FETCH_DISPLAY
  );
  const newItems = await filterNewItems(items);
  if (newItems.length === 0) {
    return { fetchedCount: items.length, insertedCount: 0 };
  }

  const preparedRaw = await mapWithConcurrency(
    newItems,
    CRAWL_CONCURRENCY,
    (item) => prepareItem(item, query)
  );
  const prepared = preparedRaw.filter(
    (item): item is PreparedNews => item !== null
  );
  if (prepared.length === 0) {
    return { fetchedCount: items.length, insertedCount: 0 };
  }

  /* ----(뉴스 AI 배치 분류 적용: 시작)---- */
  // AI가 카테고리를 붙이고, 증시 무관(none)은 여기서 걸러진다.
  const classified = await applyAiCategories(prepared);
  if (classified.length === 0) {
    return { fetchedCount: items.length, insertedCount: 0 };
  }
  /* ----(뉴스 AI 배치 분류 적용: 끝)---- */

  const inserted = await getDb()
    .insert(news)
    .values(classified)
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
