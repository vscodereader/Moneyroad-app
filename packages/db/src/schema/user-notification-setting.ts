import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userNotificationSetting = pgTable("user_notification_setting", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  buySignal: boolean("buy_signal").notNull().default(true),
  sellSignal: boolean("sell_signal").notNull().default(true),
  priceAlert: boolean("price_alert").notNull().default(true),
  breakingNews: boolean("breaking_news").notNull().default(true),
  marketSummary: boolean("market_summary").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
