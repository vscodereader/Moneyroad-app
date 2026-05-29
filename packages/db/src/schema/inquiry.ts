import {
  index,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const inquiryType = pgEnum("inquiry_type", [
  "signal",
  "subscription",
  "account",
  "etc",
]);

export const inquiryStatus = pgEnum("inquiry_status", [
  "open",
  "answered",
  "closed",
]);

// 1:1 customer support inquiries. Kept even if the author is deleted
// (user_id → NULL); contact_email is captured at submit time so support can
// still reply.
export const inquiry = pgTable(
  "inquiry",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    contactEmail: text("contact_email"),
    type: inquiryType("type").notNull().default("etc"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: inquiryStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("inquiry_user_idx").on(table.userId),
    index("inquiry_created_idx").on(table.createdAt),
  ]
);
