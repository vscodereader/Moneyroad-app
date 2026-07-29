import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { stockMaster } from "./stock-master";

export const news = pgTable(
  "news",
  {
    id: text("id").primaryKey(),
    /** 네이버 원본 링크 (자동수집 중복 방지용, 수동 업로드 시 null) */
    originallink: text("originallink").unique(),
    title: text("title").notNull(),
    link: text("link"),
    description: text("description").notNull().default(""),
    /** AI 요약 (수집 시 생성, AI 비활성 시 null) */
    summary: text("summary"),
    pubDate: timestamp("pub_date").notNull(),
    query: text("query"),
    source: text("source"),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>(),
    content: text("content"),
    stockCode: text("stock_code").references(() => stockMaster.mkscShrnIscd, {
      onDelete: "set null",
    }),
    sourceType: text("source_type", { enum: ["auto", "manual"] })
      .notNull()
      .default("auto"),
    // ----(관리자 뉴스 작성: 다중 카테고리·상단고정·작성자)----
    /** 수동 기사의 다중 카테고리. 자동수집 기사는 null(단일 category만). */
    categories: jsonb("categories").$type<string[]>(),
    /** 상단 고정. 선택 카테고리 탭에서만 최상단(전체/watch 탭은 시간순). */
    pinned: boolean("pinned").notNull().default(false),
    /** 작성 관리자(감사용). 작성자가 삭제돼도 기사 보존(→ NULL). */
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // ----(끝)----
    // ----(뉴스 썸네일: GCS 공개 URL. null이면 UI에서 텍스트 박스 폴백)----
    newsThumbnail: text("news_thumbnail"),
    // ----(끝)----
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("news_pub_date_idx").on(table.pubDate),
    index("news_query_idx").on(table.query),
    index("news_stock_code_idx").on(table.stockCode),
    index("news_source_type_idx").on(table.sourceType),
    // ----(관리자 뉴스: 핀 우선 정렬 지원)----
    index("news_pinned_pub_date_idx").on(table.pinned, table.pubDate),
  ]
);
