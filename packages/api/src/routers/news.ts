import { db } from "@moneyroad-app/db";
import { news, stockMaster, userWatchlist } from "@moneyroad-app/db/schema";
import { and, desc, eq, inArray, lt, type SQL } from "drizzle-orm";
import z from "zod";

import { publicProcedure } from "../index";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PREVIEW_MAX = 280;
const AI_FALLBACK_MAX = 160;
const THUMB_MAX = 8;

const tabSchema = z.enum(["watch", "all", "industry", "market", "policy"]);

// Screen-facing item shape (mirrors apps/native NewsItem).
export interface FeedItem {
  ai: string;
  aiGenerated: boolean;
  category: string;
  code: string;
  id: string;
  sentiment: "up" | "down";
  source: string;
  stockName: string | null;
  thumbHint: string;
  time: string;
  title: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  market: "시장",
  sector: "산업",
  global: "해외",
  company: "기업",
  other: "정책",
};

function categoryLabel(category: string | null): string {
  if (!category) {
    return "뉴스";
  }
  return CATEGORY_LABELS[category] ?? "뉴스";
}

// Our category taxonomy (market/sector/global/company/other) mapped onto the
// screen's tabs. "policy" has no dedicated classifier yet → reuses "other".
function categoryFilter(tab: z.infer<typeof tabSchema>): SQL | undefined {
  switch (tab) {
    case "industry":
      return eq(news.category, "sector");
    case "market":
      return inArray(news.category, ["market", "global"]);
    case "policy":
      return eq(news.category, "other");
    default:
      return;
  }
}

const DOWN_KEYWORDS = [
  "급락",
  "하락",
  "폭락",
  "하한가",
  "약세",
  "적자",
  "부진",
  "감소",
  "마이너스",
  "손실",
];

// No sentiment column yet; cheap heuristic from the title until a model adds it.
function sentimentOf(title: string): "up" | "down" {
  return DOWN_KEYWORDS.some((k) => title.includes(k)) ? "down" : "up";
}

const MS = { min: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < MS.min) {
    return "방금";
  }
  if (diff < MS.hour) {
    return `${Math.floor(diff / MS.min)}분 전`;
  }
  if (diff < MS.day) {
    return `${Math.floor(diff / MS.hour)}시간 전`;
  }
  return `${Math.floor(diff / MS.day)}일 전`;
}

// tags[0] is the search query (same for every item); prefer a title keyword.
function thumbHintOf(tags: string[] | null, label: string): string {
  const keyword = tags
    ?.slice(1)
    .find((tag) => tag.length >= 2 && tag.length <= THUMB_MAX);
  return (keyword ?? label).slice(0, THUMB_MAX);
}

interface NewsRow {
  category: string | null;
  description: string;
  id: string;
  pubDate: Date;
  source: string | null;
  stockCode: string | null;
  summary: string | null;
  tags: string[] | null;
  title: string;
}

function toFeedItem(row: NewsRow, stockName: string | null): FeedItem {
  const label = categoryLabel(row.category);
  return {
    id: row.id,
    code: row.stockCode ?? "",
    category: label,
    title: row.title,
    source: row.source ?? "뉴스",
    time: relativeTime(row.pubDate),
    sentiment: sentimentOf(row.title),
    thumbHint: thumbHintOf(row.tags, label),
    ai: row.summary ?? row.description.slice(0, AI_FALLBACK_MAX),
    aiGenerated: Boolean(row.summary),
    stockName,
  };
}

/** Stock code → name for the given codes (one round trip). */
async function stockNames(codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ code: stockMaster.mkscShrnIscd, name: stockMaster.htsKorIsnm })
    .from(stockMaster)
    .where(inArray(stockMaster.mkscShrnIscd, codes));
  return new Map(rows.map((r) => [r.code, r.name]));
}

export const newsRouter = {
  feed: publicProcedure
    .input(
      z.object({
        tab: tabSchema.default("all"),
        // Limit to one stock (used by the stock detail screen).
        code: z.string().optional(),
        // Keyset cursor: pubDate (ISO) of the last item from the previous page.
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
      })
    )
    .handler(async ({ input, context }) => {
      const filters: SQL[] = [];

      if (input.tab === "watch") {
        const userId = context.session?.user?.id;
        if (!userId) {
          return { items: [] as FeedItem[], nextCursor: null };
        }
        const watched = await db
          .selectDistinct({ stockCode: userWatchlist.stockCode })
          .from(userWatchlist)
          .where(
            and(
              eq(userWatchlist.userId, userId),
              eq(userWatchlist.type, "news")
            )
          );
        const codes = watched.map((w) => w.stockCode);
        if (codes.length === 0) {
          return { items: [] as FeedItem[], nextCursor: null };
        }
        filters.push(inArray(news.stockCode, codes));
      } else {
        const catFilter = categoryFilter(input.tab);
        if (catFilter) {
          filters.push(catFilter);
        }
      }

      if (input.code) {
        filters.push(eq(news.stockCode, input.code));
      }

      if (input.cursor) {
        const cursorDate = new Date(input.cursor);
        if (!Number.isNaN(cursorDate.getTime())) {
          filters.push(lt(news.pubDate, cursorDate));
        }
      }

      const rows = await db
        .select({
          id: news.id,
          title: news.title,
          description: news.description,
          summary: news.summary,
          source: news.source,
          category: news.category,
          tags: news.tags,
          stockCode: news.stockCode,
          pubDate: news.pubDate,
        })
        .from(news)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(news.pubDate))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;

      const codes = [
        ...new Set(
          page.map((r) => r.stockCode).filter((c): c is string => Boolean(c))
        ),
      ];
      const names = await stockNames(codes);

      const items = page.map((r) =>
        toFeedItem(r, r.stockCode ? (names.get(r.stockCode) ?? null) : null)
      );
      const last = page.at(-1);
      const nextCursor = hasMore && last ? last.pubDate.toISOString() : null;

      return { items, nextCursor };
    }),

  detail: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const [row] = await db
        .select({
          id: news.id,
          title: news.title,
          description: news.description,
          summary: news.summary,
          source: news.source,
          link: news.link,
          stockCode: news.stockCode,
          pubDate: news.pubDate,
        })
        .from(news)
        .where(eq(news.id, input.id))
        .limit(1);

      if (!row) {
        return null;
      }

      let stock: { code: string; name: string } | null = null;
      if (row.stockCode) {
        const [s] = await db
          .select({ name: stockMaster.htsKorIsnm })
          .from(stockMaster)
          .where(eq(stockMaster.mkscShrnIscd, row.stockCode))
          .limit(1);
        if (s) {
          stock = { code: row.stockCode, name: s.name };
        }
      }

      return {
        id: row.id,
        title: row.title,
        source: row.source ?? "뉴스",
        time: relativeTime(row.pubDate),
        ai: row.summary ?? row.description.slice(0, AI_FALLBACK_MAX),
        aiGenerated: Boolean(row.summary),
        url: row.link ?? null,
        preview: row.description.slice(0, PREVIEW_MAX) || null,
        stock,
      };
    }),
};
