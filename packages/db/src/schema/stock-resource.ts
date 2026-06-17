import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { stockMaster } from "./stock-master";

export const stockResource = pgTable(
  "stock_resource",
  {
    id: serial("id").primaryKey(),
    stockCode: text("stock_code")
      .notNull()
      .references(() => stockMaster.mkscShrnIscd, { onDelete: "cascade" }),
    resourceType: text("resource_type", { enum: ["icon"] }).notNull(),
    provider: text("provider").notNull(),
    sourceUrl: text("source_url"),
    storageBucket: text("storage_bucket"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull().default("image/png"),
    status: text("status", { enum: ["failed", "missing", "ready"] }).notNull(),
    contentHash: text("content_hash"),
    etag: text("etag"),
    errorMessage: text("error_message"),
    byteSize: integer("byte_size"),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("stock_resource_stock_type_idx").on(
      table.stockCode,
      table.resourceType
    ),
    index("stock_resource_status_idx").on(table.status),
  ]
);
