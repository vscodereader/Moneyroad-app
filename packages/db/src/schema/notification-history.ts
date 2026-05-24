import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const notificationType = pgEnum("notification_type", [
  "buy_signal",
  "sell_signal",
  "price_alert",
  "breaking_news",
  "market_summary",
]);

export const deliveryStatus = pgEnum("delivery_status", [
  "pending",
  "sent",
  "failed",
  "bounced",
  "no_recipients",
]);

export const notificationHistory = pgTable(
  "notification_history",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    read: boolean("read").notNull().default(false),
    // 발송 추적
    deliveryStatus: deliveryStatus("delivery_status")
      .notNull()
      .default("pending"),
    ticketId: text("ticket_id"),
    failedReason: text("failed_reason"),
    recipientCount: integer("recipient_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_history_user_idx").on(table.userId, table.createdAt),
    // 피로도 쿨다운 체크 및 receipts 조회용
    index("notification_history_user_type_created_idx").on(
      table.userId,
      table.type,
      table.createdAt
    ),
    index("notification_history_ticket_idx").on(table.ticketId),
  ]
);
