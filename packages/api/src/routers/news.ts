import { randomUUID } from "node:crypto";

import { db } from "@moneyroad-app/db";
import { news, stockMaster, userWatchlist } from "@moneyroad-app/db/schema";
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import z from "zod";

import { adminProcedure, publicProcedure } from "../index";
import { refreshRealtimeNews } from "../lib/realtime-trigger";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PREVIEW_MAX = 280;
const AI_FALLBACK_MAX = 160;
const THUMB_MAX = 8;
// 핀 기사는 관리자 소량 전제 — 카테고리 탭 1페이지 상단에 한 번에 노출(상한).
const PINNED_CAP = 100;

// ----(추가: 기업(company)·해외(global) 탭)----
const tabSchema = z.enum([
  "watch",
  "all",
  "market",
  "industry",
  "company",
  "global",
  "policy",
]);

// ----(관리자 뉴스 작성: 저장 카테고리 값 + 입력 스키마)----
// 저장 값(탭 id와 다름): 시장/산업/기업/해외/정책 → market/sector/company/global/other
const NEWS_CATEGORY_VALUES = [
  "market",
  "sector",
  "company",
  "global",
  "other",
] as const;

const authorInput = z.object({
  categories: z.array(z.enum(NEWS_CATEGORY_VALUES)).min(1),
  pinned: z.boolean().default(false),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(4000),
  link: z.string().url().optional(),
  // ----(뉴스 썸네일: 업로드 라우트가 돌려준 GCS 공개 URL)----
  // 안 보내면 컬럼이 null이 되고 앱이 머니로드 기본 이미지를 그린다(RFC 0006 Q6).
  // 즉 update에서 이 필드를 비우는 것이 "썸네일 해제"다.
  thumbnailUrl: z.string().url().optional(),
  // ----(끝)----
});
// ----(끝)----

// Screen-facing item shape (mirrors apps/native NewsItem).
export interface FeedItem {
  ai: string;
  aiGenerated: boolean;
  category: string;
  code: string;
  // ----(머니로드 독점 기사 표식)----
  // 앱이 source 문구("머니로드 독점")로 비교하면 표시 문구를 다듬는 순간 조용히
  // 깨진다. 판별은 서버가 sourceType으로 하고 앱은 불리언만 본다.
  exclusive: boolean;
  // ----(끝)----
  id: string;
  imageUrl: string | null;
  pinned: boolean;
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

// 탭 id → 저장된 카테고리 값. all/watch → undefined(카테고리 필터 없음).
// "policy"는 전용 분류기가 없어 "other"를 재사용.
const TAB_CATEGORY: Record<string, string> = {
  market: "market",
  industry: "sector",
  company: "company",
  global: "global",
  policy: "other",
};

function tabCategoryValue(tab: z.infer<typeof tabSchema>): string | undefined {
  return TAB_CATEGORY[tab];
}

// 수동 기사(다중 categories) 또는 자동 기사(단일 category) 모두 매칭.
function categoryFilter(tab: z.infer<typeof tabSchema>): SQL | undefined {
  const value = tabCategoryValue(tab);
  if (!value) {
    return;
  }
  return or(
    eq(news.category, value),
    sql`${news.categories} @> ${JSON.stringify([value])}::jsonb`
  );
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
  newsThumbnail: string | null;
  pinned: boolean;
  pubDate: Date;
  source: string | null;
  sourceType: "auto" | "manual";
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
    pinned: row.pinned,
    imageUrl: row.newsThumbnail,
    // ----(머니로드 독점 기사 표식)----
    // 관리자 작성 기사(create가 넣는 sourceType)만 독점이다.
    exclusive: row.sourceType === "manual",
    // ----(끝)----
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

// 피드 공통 SELECT 컬럼(pinned 포함 — 핀 정렬·표시용).
const feedColumns = {
  id: news.id,
  title: news.title,
  description: news.description,
  summary: news.summary,
  source: news.source,
  category: news.category,
  tags: news.tags,
  stockCode: news.stockCode,
  pubDate: news.pubDate,
  pinned: news.pinned,
  newsThumbnail: news.newsThumbnail,
  // ----(머니로드 독점 기사 표식: FeedItem.exclusive 계산용)----
  sourceType: news.sourceType,
  // ----(끝)----
};

function fetchNewsRows(where: SQL | undefined, limit: number) {
  return db
    .select(feedColumns)
    .from(news)
    .where(where)
    .orderBy(desc(news.pubDate))
    .limit(limit);
}

function parseCursor(cursor: string | undefined): Date | undefined {
  if (!cursor) {
    return;
  }
  const date = new Date(cursor);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// 핀 우선(선택 카테고리 탭에서만) + pubDate 키셋 페이지네이션.
// - 카테고리 탭 1페이지: 핀 전량(최신순) + 비핀 첫 페이지. 커서=마지막 비핀.
// - 카테고리 탭 2페이지+: 비핀만(핀은 1페이지에서 소진 → 중복 방지).
// - 전체/watch 탭: 핀 우선 없음(시간순).
async function fetchNewsFeedPage(
  tab: z.infer<typeof tabSchema>,
  baseFilters: SQL[],
  cursor: Date | undefined,
  limit: number
): Promise<{ page: NewsRow[]; nextCursor: string | null }> {
  const isCategoryTab = Boolean(tabCategoryValue(tab));

  if (isCategoryTab && !cursor) {
    const [pinnedRows, nonPinned] = await Promise.all([
      fetchNewsRows(and(...baseFilters, eq(news.pinned, true)), PINNED_CAP),
      fetchNewsRows(and(...baseFilters, eq(news.pinned, false)), limit + 1),
    ]);
    const hasMore = nonPinned.length > limit;
    const nonPinnedPage = hasMore ? nonPinned.slice(0, limit) : nonPinned;
    const last = nonPinnedPage.at(-1);
    return {
      page: [...pinnedRows, ...nonPinnedPage],
      nextCursor: hasMore && last ? last.pubDate.toISOString() : null,
    };
  }

  const filters = [...baseFilters];
  if (isCategoryTab) {
    filters.push(eq(news.pinned, false));
  }
  if (cursor) {
    filters.push(lt(news.pubDate, cursor));
  }
  const rows = await fetchNewsRows(and(...filters), limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    page,
    nextCursor: hasMore && last ? last.pubDate.toISOString() : null,
  };
}

async function buildFeedResponse(
  page: NewsRow[],
  nextCursor: string | null
): Promise<{ items: FeedItem[]; nextCursor: string | null }> {
  const codes = [
    ...new Set(
      page.map((r) => r.stockCode).filter((c): c is string => Boolean(c))
    ),
  ];
  const names = await stockNames(codes);
  const items = page.map((r) =>
    toFeedItem(r, r.stockCode ? (names.get(r.stockCode) ?? null) : null)
  );
  return { items, nextCursor };
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
      // ----(추가: 카테고리 없는 '뉴스'(미분류) 기사는 피드에서 제외)----
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
        const watchFilters: SQL[] = [
          isNotNull(news.category),
          inArray(news.stockCode, codes),
        ];
        if (input.code) {
          watchFilters.push(eq(news.stockCode, input.code));
        }
        const watchPage = await fetchNewsFeedPage(
          "watch",
          watchFilters,
          parseCursor(input.cursor),
          input.limit
        );
        return await buildFeedResponse(watchPage.page, watchPage.nextCursor);
      }

      const baseFilters: SQL[] = [isNotNull(news.category)];
      const catFilter = categoryFilter(input.tab);
      if (catFilter) {
        baseFilters.push(catFilter);
      }
      if (input.code) {
        baseFilters.push(eq(news.stockCode, input.code));
      }
      const { page, nextCursor } = await fetchNewsFeedPage(
        input.tab,
        baseFilters,
        parseCursor(input.cursor),
        input.limit
      );
      return await buildFeedResponse(page, nextCursor);
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
          // ----(관리자 뉴스: 편집 프리필·버튼 노출용)----
          sourceType: news.sourceType,
          pinned: news.pinned,
          categories: news.categories,
          content: news.content,
          newsThumbnail: news.newsThumbnail,
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
        imageUrl: row.newsThumbnail ?? null,
        // ----(관리자 뉴스: 편집 프리필·버튼 노출용)----
        sourceType: row.sourceType,
        pinned: row.pinned,
        categories: row.categories ?? [],
        content: row.content ?? row.summary ?? "",
      };
    }),

  // ----(관리자 뉴스 작성: create / update / remove — adminProcedure)----
  // 작성 본문은 summary+description+content에 함께 넣어 핵심요약·원문미리보기로 그대로
  // 노출된다(RFC 0002 D5). 출처="머니로드 독점", 대표 category=categories[0](하위호환).
  create: adminProcedure
    .input(authorInput)
    .handler(async ({ input, context }) => {
      const id = randomUUID();
      const body = input.content.trim();
      await db.insert(news).values({
        id,
        sourceType: "manual",
        originallink: null,
        source: "머니로드 독점",
        category: input.categories[0] ?? "other",
        categories: input.categories,
        pinned: input.pinned,
        title: input.title.trim(),
        summary: body,
        description: body,
        content: body,
        link: input.link ?? null,
        // ----(뉴스 썸네일: 미첨부면 null → 앱이 기본 이미지로 그린다)----
        newsThumbnail: input.thumbnailUrl ?? null,
        // ----(끝)----
        pubDate: new Date(),
        authorId: context.session.user.id,
      });
      // 다른 사용자에게도 즉시 반영(realtime broadcast). 핀 스트림과 무관.
      refreshRealtimeNews("news.create");
      return { id };
    }),

  // sourceType='manual' 가드 — 자동수집 기사는 편집 대상 아님.
  update: adminProcedure
    .input(authorInput.extend({ id: z.string() }))
    .handler(async ({ input }) => {
      const body = input.content.trim();
      const updated = await db
        .update(news)
        .set({
          category: input.categories[0] ?? "other",
          categories: input.categories,
          pinned: input.pinned,
          title: input.title.trim(),
          summary: body,
          description: body,
          content: body,
          link: input.link ?? null,
          // ----(뉴스 썸네일: 교체·해제)----
          // 폼이 항상 현재 값을 실어 보내므로 빈 값 = 관리자가 ✕로 뗀 것이다.
          // null로 덮어 써야 기본 이미지로 되돌아간다.
          newsThumbnail: input.thumbnailUrl ?? null,
          // ----(끝)----
        })
        .where(and(eq(news.id, input.id), eq(news.sourceType, "manual")))
        .returning({ id: news.id });
      if (updated.length === 0) {
        throw new Error("수정할 기사를 찾을 수 없습니다.");
      }
      refreshRealtimeNews("news.update");
      return { id: input.id };
    }),

  remove: adminProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
      const removed = await db
        .delete(news)
        .where(and(eq(news.id, input.id), eq(news.sourceType, "manual")))
        .returning({ id: news.id });
      if (removed.length === 0) {
        throw new Error("삭제할 기사를 찾을 수 없습니다.");
      }
      refreshRealtimeNews("news.remove");
      return { ok: true };
    }),
  // ----(끝)----
};
