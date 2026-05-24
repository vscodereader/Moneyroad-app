import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { stockMaster } from "./stock-master";

export const watchlistType = pgEnum("watchlist_type", ["signal", "news"]);

export const userWatchlist = pgTable(
  "user_watchlist",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stockCode: text("stock_code")
      .notNull()
      .references(() => stockMaster.mkscShrnIscd, { onDelete: "cascade" }),
    type: watchlistType("type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.stockCode, table.type] }),
    index("user_watchlist_user_type_idx").on(table.userId, table.type),
  ]
);
