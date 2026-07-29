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
  /* ----(관망 시그널 알림 타입 — RFC 0007 D1)---- */
  // 시그널 액션은 매수/매도/관망 3종이고 알림 설정도 buySignal/sellSignal/
  // holdSignal 3종인데, 여기만 hold_signal 이 빠져 있어 관망 시그널은 발송
  // 기록을 남길 수 없었다 → 설정의 "관망 시그널" 토글이 무동작이었다.
  // docs/native/api/signals.md 는 "액션 3종과 알림 설정이 일치한다"고 정의한다.
  "hold_signal",
  /* ----(~관망 시그널 알림 타입 여기까지)---- */
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
