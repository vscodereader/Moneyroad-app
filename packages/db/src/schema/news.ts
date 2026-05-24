import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("news_pub_date_idx").on(table.pubDate),
    index("news_query_idx").on(table.query),
    index("news_stock_code_idx").on(table.stockCode),
    index("news_source_type_idx").on(table.sourceType),
  ]
);
