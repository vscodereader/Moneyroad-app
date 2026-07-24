import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { moneyroadImage } from "./image";
import { stockMaster } from "./stock-master";

// Admin-set tone on a room. Default "neutral" → ThreadRow hides the pill.
// Editable later by admin (Q5).
export const discussionSentiment = pgEnum("discussion_sentiment", [
  "up",
  "neutral",
  "down",
]);

// Message payload kind. "text" is the default; "image"/"file" carry an
// attachment (docs/rfcs/0004 기능5). Image messages additionally link rows in
// discussion_message_image; file messages use the file* columns below.
export const discussionMessageType = pgEnum("discussion_message_type", [
  "text",
  "image",
  "file",
]);

export const discussionRoom = pgTable(
  "discussion_room",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").default("").notNull(),
    // Optional stock binding. On stock_master row delete → become a general
    // room (stock_code → NULL) instead of cascading the discussion away.
    // See docs/adr/0003.
    stockCode: text("stock_code").references(() => stockMaster.mkscShrnIscd, {
      onDelete: "set null",
    }),
    sentiment: discussionSentiment("sentiment").notNull().default("neutral"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("discussion_room_stock_code_idx").on(table.stockCode),
    index("discussion_room_created_at_idx").on(table.createdAt),
  ]
);

export const discussionMessage = pgTable(
  "discussion_message",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => discussionRoom.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    // Payload kind (docs/rfcs/0004 기능5). "text" for plain messages; "image"
    // links rows in discussion_message_image; "file" populates the file*
    // columns below.
    type: discussionMessageType("type").notNull().default("text"),
    // Attachment metadata for FILE messages (all NULL for text/image). Mirrors
    // the bucket/objectKey pointer model of stock_resource: the row references
    // bytes in object storage rather than storing them inline.
    fileBucket: text("file_bucket"),
    fileKey: text("file_key"),
    fileMime: text("file_mime"),
    fileSize: integer("file_size"),
    fileName: text("file_name"),
    // Soft delete: rows survive moderation; client renders the placeholder
    // "삭제된 메시지입니다" when deletedAt is non-null.
    deletedAt: timestamp("deleted_at"),
    // Admin blind (가림): message is masked for everyone but the row survives.
    // Client renders a "가려진 메시지입니다" placeholder + blindReason when
    // blindedAt is non-null. Independent of deletedAt (docs/rfcs/0004 기능2).
    blindedAt: timestamp("blinded_at"),
    blindedBy: text("blinded_by").references(() => user.id, {
      onDelete: "set null",
    }),
    blindReason: text("blind_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Cursor pagination key for the "이력 fetch + 라이브 구독" model
    // (docs/adr/0001 #2). Composite (room_id, id desc) keeps room slices contiguous.
    index("discussion_message_room_id_idx").on(table.roomId, table.id),
    // Used by room list queries that need MAX(createdAt) per room for the
    // "최신" tab and the "마지막 활동" label.
    index("discussion_message_room_created_at_idx").on(
      table.roomId,
      table.createdAt
    ),
  ]
);

// Member = a user who has posted in the room at least once (implicit join,
// docs/adr/0002). Rows are inserted via ON CONFLICT DO NOTHING on first send;
// removed on explicit leaveRoom.
export const discussionRoomMember = pgTable(
  "discussion_room_member",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => discussionRoom.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    // Temporary mute (뮤트): while mutedUntil is in the future the member may
    // read but cannot post. Cleared on unmute (docs/rfcs/0004 기능4). Total
    // duration is capped at 1 day by the api layer.
    mutedUntil: timestamp("muted_until"),
    mutedBy: text("muted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roomId] })]
);

// Per-room block (차단): a user removed from the room and barred from posting
// until blockedUntil. Mirrors the member table; the member row is deleted on
// block and this row gates re-entry (docs/rfcs/0004 기능4). Total duration is
// capped at 7 days by the api layer.
export const discussionRoomBlock = pgTable(
  "discussion_room_block",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => discussionRoom.id, { onDelete: "cascade" }),
    blockedBy: text("blocked_by").references(() => user.id, {
      onDelete: "set null",
    }),
    blockedAt: timestamp("blocked_at").defaultNow().notNull(),
    blockedUntil: timestamp("blocked_until").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roomId] })]
);

// Per-user like on a room. Toggled by inserting / deleting this row.
// The "인기" tab orders by COUNT(*) over this table; no denormalized counter
// is kept until the popular-tab query is observed to be slow (Q4).
export const discussionRoomLike = pgTable(
  "discussion_room_like",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => discussionRoom.id, { onDelete: "cascade" }),
    likedAt: timestamp("liked_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roomId] })]
);

// Ordered attachments for an IMAGE message. Join table between
// discussion_message and moneyroad_image; sortOrder preserves the client's
// display order (docs/rfcs/0004 기능5). Composite PK forbids linking the same
// image to a message twice.
export const discussionMessageImage = pgTable(
  "discussion_message_image",
  {
    messageId: integer("message_id")
      .notNull()
      .references(() => discussionMessage.id, { onDelete: "cascade" }),
    imageId: integer("image_id")
      .notNull()
      .references(() => moneyroadImage.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.imageId] })]
);

// Per-user favorite (별) on a room. Toggled by inserting / deleting this row.
// The "즐겨찾기" tab filters to rooms the signed-in user has favorited; mirrors
// the like table one-for-one (docs/rfcs/0004 기능3).
export const discussionRoomFavorite = pgTable(
  "discussion_room_favorite",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    roomId: integer("room_id")
      .notNull()
      .references(() => discussionRoom.id, { onDelete: "cascade" }),
    favoritedAt: timestamp("favorited_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roomId] })]
);
