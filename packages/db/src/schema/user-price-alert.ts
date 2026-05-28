import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { stockMaster } from "./stock-master";

// "above" → 목표가 이상일 때, "below" → 목표가 이하일 때 알림.
export const priceAlertDirection = pgEnum("price_alert_direction", [
  "above",
  "below",
]);

export const userPriceAlert = pgTable(
  "user_price_alert",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stockCode: text("stock_code")
      .notNull()
      .references(() => stockMaster.mkscShrnIscd, { onDelete: "cascade" }),
    direction: priceAlertDirection("direction").notNull(),
    // Absolute target price in KRW. A percent-based input is converted to this
    // value at creation time.
    targetPrice: integer("target_price").notNull(),
    active: boolean("active").notNull().default(true),
    // Set once the alert first fires (null = not yet triggered).
    triggeredAt: timestamp("triggered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("user_price_alert_user_idx").on(table.userId),
    index("user_price_alert_stock_idx").on(table.stockCode),
  ]
);
