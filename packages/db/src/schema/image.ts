import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// Stored image object. Mirrors the storage-backed resource model used by
// stock_resource: the row is metadata + a bucket/objectKey pointer to the
// actual bytes in object storage. Referenced by discussion message images
// (docs/rfcs/0004 기능5).
export const moneyroadImage = pgTable("moneyroad_image", {
  id: serial("id").primaryKey(),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),
  mime: text("mime").notNull(),
  byteSize: integer("byte_size").notNull(),
  // Original upload bytes are kept separately because Jimp re-encoding can
  // shrink or grow the stored object. RFC 0004's 10MB message limit is based
  // on the originals selected by the user, not the encoded output.
  originalByteSize: integer("original_byte_size"),
  width: integer("width"),
  height: integer("height"),
  uploaderId: text("uploader_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
