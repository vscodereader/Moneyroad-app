import {
  boolean,
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

// 공지사항 분류: 공지 / 업데이트 / 이벤트.
export const noticeCategory = pgEnum("notice_category", [
  "notice",
  "update",
  "event",
]);

// 관리자가 작성하는 공지사항. 핀(pinned)은 목록 최상단 고정용. 작성자가 삭제돼도
// 공지는 보존(created_by → NULL).
export const notice = pgTable(
  "notice",
  {
    id: serial("id").primaryKey(),
    category: noticeCategory("category").notNull().default("notice"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    pinned: boolean("pinned").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // 목록 정렬: pinned DESC, created_at DESC.
    index("notice_pinned_created_idx").on(table.pinned, table.createdAt),
    index("notice_created_idx").on(table.createdAt),
  ]
);
