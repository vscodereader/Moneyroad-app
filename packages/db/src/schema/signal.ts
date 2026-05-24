import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Primary classification (current): the action the signal suggests.
export const signalAction = pgEnum("signal_action", ["buy", "sell", "hold"]);

// Secondary classification (future): how the signal was derived. The engine
// only produces "tech" for now; the others are reserved for later sources.
export const signalSource = pgEnum("signal_source", [
  "tech",
  "ai",
  "event",
  "community",
]);

export const signal = pgTable(
  "signal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    // Short code (mkscShrnIscd); no FK so signals survive a stock_master reload.
    stockCode: text("stock_code").notNull(),
    action: signalAction("action").notNull(),
    source: signalSource("source").notNull().default("tech"),
    // 1 (weak) .. 5 (strong).
    strength: integer("strength").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Raw indicator values behind the signal (e.g. rsi, ma cross, volume).
    indicators: jsonb("indicators").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("signal_stock_created_idx").on(table.stockCode, table.createdAt),
    index("signal_action_created_idx").on(table.action, table.createdAt),
    index("signal_created_idx").on(table.createdAt),
  ]
);
