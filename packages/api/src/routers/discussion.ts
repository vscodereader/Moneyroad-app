import { db } from "@moneyroad-app/db";
import {
  discussionMessage,
  discussionMessageImage,
  discussionRoom,
  discussionRoomBlock,
  discussionRoomFavorite,
  discussionRoomLike,
  discussionRoomMember,
  moneyroadImage,
  stockMaster,
  user,
  userWatchlist,
} from "@moneyroad-app/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, isNull, lt, type SQL, sql } from "drizzle-orm";
import z from "zod";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";
import { refreshRealtimeDiscussion } from "../lib/realtime-trigger";

// ── shared types & helpers ───────────────────────────────────────────

const tabSchema = z.enum(["hot", "watch", "recent", "favorite"]);
const sentimentSchema = z.enum(["up", "neutral", "down"]);

const MS = { min: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < MS.min) {
    return "방금";
  }
  if (diff < MS.hour) {
    return `${Math.floor(diff / MS.min)}분 전`;
  }
  if (diff < MS.day) {
    return `${Math.floor(diff / MS.hour)}시간 전`;
  }
  return `${Math.floor(diff / MS.day)}일 전`;
}

// Correlated subquery snippets re-used in both list and detail queries.
function counts(roomIdRef: SQL<number>) {
  return {
    likesCount: sql<number>`(SELECT COUNT(*)::int FROM ${discussionRoomLike} WHERE ${discussionRoomLike.roomId} = ${roomIdRef})`,
    membersCount: sql<number>`(SELECT COUNT(*)::int FROM ${discussionRoomMember} WHERE ${discussionRoomMember.roomId} = ${roomIdRef})`,
    repliesCount: sql<number>`(SELECT COUNT(*)::int FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${roomIdRef} AND ${discussionMessage.deletedAt} IS NULL AND ${discussionMessage.blindedAt} IS NULL)`,
    // Raw sql subquery: pg returns a tz-naive string, not a Date. Decode it the
    // same way drizzle decodes a `timestamp` column (treat as UTC) so callers can
    // safely call `.toISOString()` / pass it to `relativeTime`.
    lastMessageAt:
      sql<Date | null>`(SELECT MAX(${discussionMessage.createdAt}) FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${roomIdRef})`.mapWith(
        (value) => (value == null ? null : new Date(`${value as string}+0000`))
      ),
  };
}

function likedExpr(userId: string | null): SQL<boolean> {
  if (!userId) {
    return sql<boolean>`false`;
  }
  return sql<boolean>`EXISTS (SELECT 1 FROM ${discussionRoomLike} WHERE ${discussionRoomLike.roomId} = ${discussionRoom.id} AND ${discussionRoomLike.userId} = ${userId})`;
}

function favoritedExpr(userId: string | null): SQL<boolean> {
  if (!userId) {
    return sql<boolean>`false`;
  }
  return sql<boolean>`EXISTS (SELECT 1 FROM ${discussionRoomFavorite} WHERE ${discussionRoomFavorite.roomId} = ${discussionRoom.id} AND ${discussionRoomFavorite.userId} = ${userId})`;
}

// Whether the user has an active (not-yet-expired) block on the current room.
function blockedExpr(userId: string | null): SQL<boolean> {
  if (!userId) {
    return sql<boolean>`false`;
  }
  return sql<boolean>`EXISTS (SELECT 1 FROM ${discussionRoomBlock} WHERE ${discussionRoomBlock.roomId} = ${discussionRoom.id} AND ${discussionRoomBlock.userId} = ${userId} AND ${discussionRoomBlock.blockedUntil} > now())`;
}

// Duration caps (docs/rfcs/0004 기능4). value+unit are collapsed to hours here.
const MUTE_MAX_HOURS = 24; // 1일
const BLOCK_MAX_HOURS = 168; // 7일
const HOURS_PER_DAY = 24;

function toHours(value: number, unit: "hour" | "day"): number {
  return value * (unit === "day" ? HOURS_PER_DAY : 1);
}

// ── domain functions (transport-agnostic, see docs/adr/0001 #4) ──────

// Max images per image message (docs/rfcs/0004 기능5).
const MAX_MESSAGE_IMAGES = 8;

type MessageType = "text" | "image" | "file";
interface FileRef {
  bucket: string;
  key: string;
  mime: string;
  name: string;
  size: number;
}

/**
 * Insert a message. First send into a room implicitly joins the user
 * (docs/adr/0002). Future ws handlers call this same function.
 *
 * Attachments (docs/rfcs/0004 기능5): pass `imageIds` (already uploaded via
 * POST /upload/discussion-image, must belong to the sender) for an image
 * message, or `file` (from POST /upload/discussion-file). The message `type`
 * is derived from what's attached; text messages are unchanged.
 */
async function sendMessage(args: {
  roomId: number;
  userId: string;
  content: string;
  imageIds?: number[];
  file?: FileRef;
}): Promise<{ id: number; createdAt: Date }> {
  const imageIds = args.imageIds ?? [];
  let type: MessageType = "text";
  if (args.file) {
    type = "file";
  } else if (imageIds.length > 0) {
    type = "image";
  }

  if (imageIds.length > MAX_MESSAGE_IMAGES) {
    throw new ORPCError("BAD_REQUEST", {
      message: `이미지는 최대 ${MAX_MESSAGE_IMAGES}장까지 가능합니다.`,
    });
  }
  if (type === "text" && args.content.length === 0) {
    throw new ORPCError("BAD_REQUEST", { message: "빈 메시지입니다." });
  }

  const room = await db
    .select({ id: discussionRoom.id })
    .from(discussionRoom)
    .where(eq(discussionRoom.id, args.roomId))
    .limit(1);
  if (room.length === 0) {
    throw new ORPCError("NOT_FOUND", { message: "토론방이 없습니다." });
  }

  // Moderation gate (docs/rfcs/0004 기능4): an active block bars the user from
  // the room entirely; an active mute lets them read but not post.
  const [block] = await db
    .select({ userId: discussionRoomBlock.userId })
    .from(discussionRoomBlock)
    .where(
      and(
        eq(discussionRoomBlock.userId, args.userId),
        eq(discussionRoomBlock.roomId, args.roomId),
        sql`${discussionRoomBlock.blockedUntil} > now()`
      )
    )
    .limit(1);
  if (block) {
    throw new ORPCError("FORBIDDEN", { message: "차단된 방입니다." });
  }

  const [muted] = await db
    .select({ userId: discussionRoomMember.userId })
    .from(discussionRoomMember)
    .where(
      and(
        eq(discussionRoomMember.userId, args.userId),
        eq(discussionRoomMember.roomId, args.roomId),
        sql`${discussionRoomMember.mutedUntil} > now()`
      )
    )
    .limit(1);
  if (muted) {
    throw new ORPCError("FORBIDDEN", { message: "뮤트 상태입니다." });
  }

  // Attachments must reference the sender's own uploads (prevents linking
  // someone else's private image / storage object).
  if (type === "image") {
    const owned = await db
      .select({ id: moneyroadImage.id })
      .from(moneyroadImage)
      .where(
        and(
          inArray(moneyroadImage.id, imageIds),
          eq(moneyroadImage.uploaderId, args.userId)
        )
      );
    if (owned.length !== imageIds.length) {
      throw new ORPCError("BAD_REQUEST", {
        message: "첨부한 이미지를 찾을 수 없습니다.",
      });
    }
  }

  // Implicit join.
  await db
    .insert(discussionRoomMember)
    .values({ userId: args.userId, roomId: args.roomId })
    .onConflictDoNothing();

  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(discussionMessage)
      .values({
        roomId: args.roomId,
        userId: args.userId,
        content: args.content,
        type,
        fileBucket: args.file?.bucket ?? null,
        fileKey: args.file?.key ?? null,
        fileMime: args.file?.mime ?? null,
        fileSize: args.file?.size ?? null,
        fileName: args.file?.name ?? null,
      })
      .returning({
        id: discussionMessage.id,
        createdAt: discussionMessage.createdAt,
      });

    if (!inserted) {
      throw new Error("메시지 저장 실패");
    }

    if (type === "image") {
      await tx.insert(discussionMessageImage).values(
        imageIds.map((imageId, index) => ({
          messageId: inserted.id,
          imageId,
          sortOrder: index,
        }))
      );
    }
    return inserted;
  });

  return row;
}

/**
 * Soft-delete a message. Author or admin only.
 */
async function deleteMessage(args: {
  messageId: number;
  actorUserId: string;
  actorRole: string;
}): Promise<void> {
  const [row] = await db
    .select({
      id: discussionMessage.id,
      userId: discussionMessage.userId,
      deletedAt: discussionMessage.deletedAt,
    })
    .from(discussionMessage)
    .where(eq(discussionMessage.id, args.messageId))
    .limit(1);
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "메시지가 없습니다." });
  }
  if (row.deletedAt) {
    return; // already deleted; idempotent
  }
  const isOwner = row.userId === args.actorUserId;
  const isAdmin = args.actorRole === "admin";
  if (!(isOwner || isAdmin)) {
    throw new ORPCError("FORBIDDEN", {
      message: "본인 메시지 또는 관리자만 삭제할 수 있습니다.",
    });
  }
  await db
    .update(discussionMessage)
    .set({ deletedAt: new Date() })
    .where(eq(discussionMessage.id, args.messageId));
}

/**
 * Admin bulk blind (가림). Masks the given messages for everyone; rows survive.
 * Scoped to the room and idempotent (skips already-blinded rows).
 */
async function hideMessages(args: {
  roomId: number;
  messageIds: number[];
  actorId: string;
  reason: string;
}): Promise<void> {
  if (args.messageIds.length === 0) {
    return;
  }
  await db
    .update(discussionMessage)
    .set({
      blindedAt: new Date(),
      blindedBy: args.actorId,
      blindReason: args.reason,
    })
    .where(
      and(
        inArray(discussionMessage.id, args.messageIds),
        eq(discussionMessage.roomId, args.roomId),
        isNull(discussionMessage.blindedAt)
      )
    );
}

/**
 * Admin bulk un-blind — clears the three blind fields. Scoped to the room.
 */
async function unhideMessages(args: {
  roomId: number;
  messageIds: number[];
}): Promise<void> {
  if (args.messageIds.length === 0) {
    return;
  }
  await db
    .update(discussionMessage)
    .set({ blindedAt: null, blindedBy: null, blindReason: null })
    .where(
      and(
        inArray(discussionMessage.id, args.messageIds),
        eq(discussionMessage.roomId, args.roomId)
      )
    );
}

/**
 * Admin bulk soft-delete. Mirrors deleteMessage but over a set; scoped to the
 * room and idempotent (skips already-deleted rows).
 */
async function deleteMessages(args: {
  roomId: number;
  messageIds: number[];
}): Promise<void> {
  if (args.messageIds.length === 0) {
    return;
  }
  await db
    .update(discussionMessage)
    .set({ deletedAt: new Date() })
    .where(
      and(
        inArray(discussionMessage.id, args.messageIds),
        eq(discussionMessage.roomId, args.roomId),
        isNull(discussionMessage.deletedAt)
      )
    );
}

/**
 * Toggle a per-user room like. Returns the new state.
 */
async function toggleLike(args: {
  roomId: number;
  userId: string;
}): Promise<{ liked: boolean; likesCount: number }> {
  const existing = await db
    .select({ userId: discussionRoomLike.userId })
    .from(discussionRoomLike)
    .where(
      and(
        eq(discussionRoomLike.userId, args.userId),
        eq(discussionRoomLike.roomId, args.roomId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(discussionRoomLike)
      .where(
        and(
          eq(discussionRoomLike.userId, args.userId),
          eq(discussionRoomLike.roomId, args.roomId)
        )
      );
  } else {
    await db
      .insert(discussionRoomLike)
      .values({ userId: args.userId, roomId: args.roomId })
      .onConflictDoNothing();
  }

  const [row] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(discussionRoomLike)
    .where(eq(discussionRoomLike.roomId, args.roomId));

  return { liked: existing.length === 0, likesCount: row?.count ?? 0 };
}

/**
 * Toggle a per-user room favorite (별). Returns the new state.
 */
async function toggleFavorite(args: {
  roomId: number;
  userId: string;
}): Promise<{ favorited: boolean }> {
  const existing = await db
    .select({ userId: discussionRoomFavorite.userId })
    .from(discussionRoomFavorite)
    .where(
      and(
        eq(discussionRoomFavorite.userId, args.userId),
        eq(discussionRoomFavorite.roomId, args.roomId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(discussionRoomFavorite)
      .where(
        and(
          eq(discussionRoomFavorite.userId, args.userId),
          eq(discussionRoomFavorite.roomId, args.roomId)
        )
      );
  } else {
    await db
      .insert(discussionRoomFavorite)
      .values({ userId: args.userId, roomId: args.roomId })
      .onConflictDoNothing();
  }

  return { favorited: existing.length === 0 };
}

/**
 * Room member roster for the admin moderation panel. Joins each member to their
 * user row and flags whether an active block exists (docs/rfcs/0004 기능4).
 */
async function roomMembers(args: { roomId: number }): Promise<
  {
    userId: string;
    name: string;
    role: string;
    joinedAt: string;
    mutedUntil: string | null;
    blocked: boolean;
  }[]
> {
  const rows = await db
    .select({
      userId: discussionRoomMember.userId,
      name: user.name,
      role: user.role,
      joinedAt: discussionRoomMember.joinedAt,
      mutedUntil: discussionRoomMember.mutedUntil,
      blocked: sql<boolean>`EXISTS (SELECT 1 FROM ${discussionRoomBlock} WHERE ${discussionRoomBlock.userId} = ${discussionRoomMember.userId} AND ${discussionRoomBlock.roomId} = ${discussionRoomMember.roomId} AND ${discussionRoomBlock.blockedUntil} > now())`,
    })
    .from(discussionRoomMember)
    .innerJoin(user, eq(discussionRoomMember.userId, user.id))
    .where(eq(discussionRoomMember.roomId, args.roomId))
    .orderBy(desc(discussionRoomMember.joinedAt));

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
    mutedUntil: r.mutedUntil?.toISOString() ?? null,
    blocked: r.blocked,
  }));
}

/**
 * Guard shared by mute/block: an admin may not moderate themselves or a fellow
 * admin (docs/rfcs/0004 기능4).
 */
async function assertModeratable(args: {
  actorId: string;
  targetUserId: string;
}): Promise<void> {
  if (args.targetUserId === args.actorId) {
    throw new ORPCError("FORBIDDEN", {
      message: "자기 자신에게는 할 수 없습니다.",
    });
  }
  const [target] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, args.targetUserId))
    .limit(1);
  if (!target) {
    throw new ORPCError("NOT_FOUND", { message: "유저가 없습니다." });
  }
  if (target.role === "admin") {
    throw new ORPCError("FORBIDDEN", {
      message: "관리자는 대상이 될 수 없습니다.",
    });
  }
}

/**
 * Temporarily mute a member (뮤트) — total duration capped at 1 day. Ensures a
 * member row exists first, then stamps mutedUntil / mutedBy.
 */
async function muteMember(args: {
  roomId: number;
  userId: string;
  hours: number;
  actorId: string;
}): Promise<void> {
  if (args.hours > MUTE_MAX_HOURS) {
    throw new ORPCError("BAD_REQUEST", {
      message: "뮤트는 최대 1일까지 가능합니다.",
    });
  }
  await assertModeratable({ actorId: args.actorId, targetUserId: args.userId });

  const mutedUntil = new Date(Date.now() + args.hours * MS.hour);
  await db
    .insert(discussionRoomMember)
    .values({ userId: args.userId, roomId: args.roomId })
    .onConflictDoNothing();
  await db
    .update(discussionRoomMember)
    .set({ mutedUntil, mutedBy: args.actorId })
    .where(
      and(
        eq(discussionRoomMember.userId, args.userId),
        eq(discussionRoomMember.roomId, args.roomId)
      )
    );
}

/** Clear a member's mute. */
async function unmuteMember(args: {
  roomId: number;
  userId: string;
}): Promise<void> {
  await db
    .update(discussionRoomMember)
    .set({ mutedUntil: null, mutedBy: null })
    .where(
      and(
        eq(discussionRoomMember.userId, args.userId),
        eq(discussionRoomMember.roomId, args.roomId)
      )
    );
}

/**
 * Block a member (차단) — total duration capped at 7 days. Removes the member
 * row (like leaveRoom) and upserts a block row that gates re-entry.
 */
async function blockMember(args: {
  roomId: number;
  userId: string;
  hours: number;
  actorId: string;
}): Promise<void> {
  if (args.hours > BLOCK_MAX_HOURS) {
    throw new ORPCError("BAD_REQUEST", {
      message: "차단은 최대 7일까지 가능합니다.",
    });
  }
  await assertModeratable({ actorId: args.actorId, targetUserId: args.userId });

  const blockedUntil = new Date(Date.now() + args.hours * MS.hour);
  await db
    .delete(discussionRoomMember)
    .where(
      and(
        eq(discussionRoomMember.userId, args.userId),
        eq(discussionRoomMember.roomId, args.roomId)
      )
    );
  await db
    .insert(discussionRoomBlock)
    .values({
      userId: args.userId,
      roomId: args.roomId,
      blockedBy: args.actorId,
      blockedUntil,
    })
    .onConflictDoUpdate({
      target: [discussionRoomBlock.userId, discussionRoomBlock.roomId],
      set: { blockedBy: args.actorId, blockedUntil, blockedAt: new Date() },
    });
}

/** Lift a member's block. */
async function unblockMember(args: {
  roomId: number;
  userId: string;
}): Promise<void> {
  await db
    .delete(discussionRoomBlock)
    .where(
      and(
        eq(discussionRoomBlock.userId, args.userId),
        eq(discussionRoomBlock.roomId, args.roomId)
      )
    );
}

// ── router ───────────────────────────────────────────────────────────

export const discussionRouter = {
  /**
   * Room list for the Discuss tab.
   *   - hot:    likes_count DESC, last_message_at DESC NULLS LAST
   *   - watch:  stockCode ∈ user.watchlist; logged-out → []
   *   - recent: last_message_at DESC NULLS LAST, created_at DESC
   */
  rooms: publicProcedure
    .input(
      z.object({
        tab: tabSchema.default("hot"),
        // Limit to one stock (used by the stock detail screen).
        stockCode: z.string().optional(),
        // Free-text search. When non-empty, overrides the tab and matches the
        // room name or its bound stock name (whitespace/case-insensitive).
        q: z.string().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session?.user?.id ?? null;
      const query = input.q?.trim() ?? "";
      const isSearch = query.length > 0;
      const filters: SQL[] = [];

      if (input.stockCode) {
        filters.push(eq(discussionRoom.stockCode, input.stockCode));
      }

      if (isSearch) {
        // Whitespace-insensitive, case-insensitive partial match on the room
        // name or its joined stock name. Overrides the tab.
        filters.push(
          sql`(replace(lower(${discussionRoom.name}), ' ', '') LIKE replace(lower('%' || ${query} || '%'), ' ', '') OR replace(lower(${stockMaster.htsKorIsnm}), ' ', '') LIKE replace(lower('%' || ${query} || '%'), ' ', ''))`
        );
      } else if (input.tab === "watch") {
        if (!userId) {
          return [];
        }
        const watched = await db
          .selectDistinct({ stockCode: userWatchlist.stockCode })
          .from(userWatchlist)
          .where(
            and(
              eq(userWatchlist.userId, userId),
              eq(userWatchlist.type, "news")
            )
          );
        const codes = watched.map((w) => w.stockCode);
        if (codes.length === 0) {
          return [];
        }
        filters.push(inArray(discussionRoom.stockCode, codes));
      } else if (input.tab === "favorite") {
        if (!userId) {
          return [];
        }
        // Rooms the signed-in user has favorited (별).
        filters.push(favoritedExpr(userId));
      }

      const c = counts(sql<number>`${discussionRoom.id}`);

      const baseQuery = db
        .select({
          id: discussionRoom.id,
          name: discussionRoom.name,
          description: discussionRoom.description,
          stockCode: discussionRoom.stockCode,
          stockName: stockMaster.htsKorIsnm,
          sentiment: discussionRoom.sentiment,
          createdAt: discussionRoom.createdAt,
          createdById: discussionRoom.createdBy,
          createdByName: user.name,
          likesCount: c.likesCount,
          membersCount: c.membersCount,
          repliesCount: c.repliesCount,
          lastMessageAt: c.lastMessageAt,
          liked: likedExpr(userId),
          favorited: favoritedExpr(userId),
        })
        .from(discussionRoom)
        .leftJoin(user, eq(discussionRoom.createdBy, user.id))
        .leftJoin(
          stockMaster,
          eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
        );

      const filteredQuery =
        filters.length > 0 ? baseQuery.where(and(...filters)) : baseQuery;

      let rows: Awaited<typeof filteredQuery>;
      if (input.tab === "hot" && !isSearch) {
        rows = await filteredQuery.orderBy(
          desc(c.likesCount),
          sql`${c.lastMessageAt} DESC NULLS LAST`
        );
      } else {
        rows = await filteredQuery.orderBy(
          sql`${c.lastMessageAt} DESC NULLS LAST`,
          desc(discussionRoom.createdAt)
        );
      }

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        stockCode: r.stockCode,
        stockName: r.stockName,
        sentiment: r.sentiment,
        createdBy: r.createdById
          ? { id: r.createdById, name: r.createdByName ?? "" }
          : null,
        createdAt: r.createdAt.toISOString(),
        lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
        // UI-ready relative label. Prefer last activity over creation.
        time: relativeTime(r.lastMessageAt ?? r.createdAt),
        likesCount: r.likesCount,
        membersCount: r.membersCount,
        repliesCount: r.repliesCount,
        liked: r.liked,
        favorited: r.favorited,
      }));
    }),

  /** Single room header — used by the DiscussionRoom screen. */
  room: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      const userId = context.session?.user?.id ?? null;
      const c = counts(sql<number>`${discussionRoom.id}`);
      const [row] = await db
        .select({
          id: discussionRoom.id,
          name: discussionRoom.name,
          description: discussionRoom.description,
          stockCode: discussionRoom.stockCode,
          stockName: stockMaster.htsKorIsnm,
          sentiment: discussionRoom.sentiment,
          createdAt: discussionRoom.createdAt,
          createdById: discussionRoom.createdBy,
          createdByName: user.name,
          likesCount: c.likesCount,
          membersCount: c.membersCount,
          repliesCount: c.repliesCount,
          lastMessageAt: c.lastMessageAt,
          liked: likedExpr(userId),
          favorited: favoritedExpr(userId),
          blocked: blockedExpr(userId),
        })
        .from(discussionRoom)
        .leftJoin(user, eq(discussionRoom.createdBy, user.id))
        .leftJoin(
          stockMaster,
          eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
        )
        .where(eq(discussionRoom.id, input.id))
        .limit(1);

      if (!row) {
        return null;
      }
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        stockCode: row.stockCode,
        stockName: row.stockName,
        sentiment: row.sentiment,
        createdBy: row.createdById
          ? { id: row.createdById, name: row.createdByName ?? "" }
          : null,
        createdAt: row.createdAt.toISOString(),
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        time: relativeTime(row.lastMessageAt ?? row.createdAt),
        likesCount: row.likesCount,
        membersCount: row.membersCount,
        repliesCount: row.repliesCount,
        liked: row.liked,
        favorited: row.favorited,
        blocked: row.blocked,
      };
    }),

  /**
   * Message list — cursor pagination (id desc). Returns oldest-first so the
   * chat screen can append without re-sort. Soft-deleted rows are returned
   * with deletedAt non-null so the client renders the placeholder.
   */
  messages: publicProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        cursor: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .handler(async ({ input }) => {
      const where = input.cursor
        ? and(
            eq(discussionMessage.roomId, input.roomId),
            lt(discussionMessage.id, input.cursor)
          )
        : eq(discussionMessage.roomId, input.roomId);

      const rows = await db
        .select({
          id: discussionMessage.id,
          userId: discussionMessage.userId,
          userName: user.name,
          userImage: user.image,
          content: discussionMessage.content,
          type: discussionMessage.type,
          fileMime: discussionMessage.fileMime,
          fileSize: discussionMessage.fileSize,
          fileName: discussionMessage.fileName,
          createdAt: discussionMessage.createdAt,
          deletedAt: discussionMessage.deletedAt,
          blindedAt: discussionMessage.blindedAt,
          blindReason: discussionMessage.blindReason,
        })
        .from(discussionMessage)
        .innerJoin(user, eq(discussionMessage.userId, user.id))
        .where(where)
        .orderBy(desc(discussionMessage.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const slice = hasMore ? rows.slice(0, input.limit) : rows;
      // Oldest first for append-friendly rendering.
      slice.reverse();

      // Batch-load image attachments for the visible image messages, ordered by
      // sortOrder. Masked (deleted/blinded) messages are excluded — their
      // attachments must not resolve (docs/rfcs/0004 기능5).
      const imageMessageIds = slice
        .filter((m) => m.type === "image" && !(m.deletedAt || m.blindedAt))
        .map((m) => m.id);
      const imagesByMessage = new Map<
        number,
        /* ----(이미지 payload 의 mime — RFC 0005 §4-1)---- */
        { imageId: number; url: string; mime: string }[]
        /* ----(~이미지 payload 의 mime 여기까지)---- */
      >();
      if (imageMessageIds.length > 0) {
        const links = await db
          .select({
            messageId: discussionMessageImage.messageId,
            imageId: discussionMessageImage.imageId,
            /* ----(갤러리 저장용 mime 선택 — RFC 0005 §4-1)---- */
            // The client needs the real type to pick a file extension before
            // saving to the gallery — MediaStore rejects an asset it can't type.
            mime: moneyroadImage.mime,
            /* ----(~갤러리 저장용 mime 선택 여기까지)---- */
          })
          .from(discussionMessageImage)
          /* ----(mime 을 얻기 위한 이미지 조인 — RFC 0005 §4-1)---- */
          .innerJoin(
            moneyroadImage,
            eq(discussionMessageImage.imageId, moneyroadImage.id)
          )
          /* ----(~mime 을 얻기 위한 이미지 조인 여기까지)---- */
          .where(inArray(discussionMessageImage.messageId, imageMessageIds))
          .orderBy(
            discussionMessageImage.messageId,
            discussionMessageImage.sortOrder
          );
        for (const link of links) {
          const list = imagesByMessage.get(link.messageId) ?? [];
          list.push({
            imageId: link.imageId,
            url: `/media/discussion-image/${link.imageId}`,
            /* ----(갤러리 저장용 mime 전달 — RFC 0005 §4-1)---- */
            mime: link.mime,
            /* ----(~갤러리 저장용 mime 전달 여기까지)---- */
          });
          imagesByMessage.set(link.messageId, list);
        }
      }

      return {
        messages: slice.map((m) => {
          const masked = Boolean(m.deletedAt || m.blindedAt);
          return {
            id: m.id,
            userId: m.userId,
            userName: m.userName,
            userImage: m.userImage,
            // Mask content when soft-deleted OR admin-blinded.
            content: masked ? null : m.content,
            type: m.type,
            // Attachment projections — null unless the message carries that kind
            // and is not masked.
            images:
              m.type === "image" && !masked
                ? (imagesByMessage.get(m.id) ?? [])
                : null,
            file:
              m.type === "file" && !masked
                ? {
                    url: `/media/discussion-file/${m.id}`,
                    name: m.fileName ?? "",
                    mime: m.fileMime ?? "application/octet-stream",
                    size: m.fileSize ?? 0,
                  }
                : null,
            createdAt: m.createdAt.toISOString(),
            deletedAt: m.deletedAt?.toISOString() ?? null,
            blindedAt: m.blindedAt?.toISOString() ?? null,
            blindReason: m.blindReason ?? null,
          };
        }),
        nextCursor: hasMore ? (slice[0]?.id ?? null) : null,
      };
    }),

  /**
   * "내가 쓴 글" — distinct rooms the signed-in user has posted a (non-deleted)
   * message in, ordered by the user's most recent activity in each. Rooms are
   * admin-created, so a user's "글" here means the threads they participate in.
   * Shaped like a room card (name + stock + like/reply counts).
   */
  myRooms: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const limit = input?.limit ?? 50;
      const c = counts(sql<number>`${discussionRoom.id}`);
      // The user's own last message time in each room (drives ordering + label).
      const myLastAt =
        sql<Date | null>`(SELECT MAX(${discussionMessage.createdAt}) FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${discussionRoom.id} AND ${discussionMessage.userId} = ${userId} AND ${discussionMessage.deletedAt} IS NULL)`.mapWith(
          (value) =>
            value == null ? null : new Date(`${value as string}+0000`)
        );
      const mine = sql`EXISTS (SELECT 1 FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${discussionRoom.id} AND ${discussionMessage.userId} = ${userId} AND ${discussionMessage.deletedAt} IS NULL)`;

      const rows = await db
        .select({
          id: discussionRoom.id,
          name: discussionRoom.name,
          stockCode: discussionRoom.stockCode,
          stockName: stockMaster.htsKorIsnm,
          sentiment: discussionRoom.sentiment,
          likesCount: c.likesCount,
          repliesCount: c.repliesCount,
          favorited: favoritedExpr(userId),
          myLastAt,
        })
        .from(discussionRoom)
        .leftJoin(
          stockMaster,
          eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
        )
        .where(mine)
        .orderBy(sql`${myLastAt} DESC NULLS LAST`)
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        stockCode: r.stockCode,
        stockName: r.stockName,
        sentiment: r.sentiment,
        likesCount: r.likesCount,
        repliesCount: r.repliesCount,
        favorited: r.favorited,
        time: r.myLastAt ? relativeTime(r.myLastAt) : "",
      }));
    }),

  /**
   * "답글" — the signed-in user's own (non-deleted) messages, newest first,
   * each joined with its room for context (room name + stock chip + link).
   */
  myReplies: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const limit = input?.limit ?? 50;

      const rows = await db
        .select({
          id: discussionMessage.id,
          roomId: discussionRoom.id,
          roomName: discussionRoom.name,
          stockCode: discussionRoom.stockCode,
          stockName: stockMaster.htsKorIsnm,
          content: discussionMessage.content,
          createdAt: discussionMessage.createdAt,
        })
        .from(discussionMessage)
        .innerJoin(
          discussionRoom,
          eq(discussionMessage.roomId, discussionRoom.id)
        )
        .leftJoin(
          stockMaster,
          eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
        )
        .where(
          and(
            eq(discussionMessage.userId, userId),
            isNull(discussionMessage.deletedAt)
          )
        )
        .orderBy(desc(discussionMessage.id))
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        roomId: r.roomId,
        roomName: r.roomName,
        stockCode: r.stockCode,
        stockName: r.stockName,
        content: r.content,
        time: relativeTime(r.createdAt),
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  send: protectedProcedure
    .input(
      z
        .object({
          roomId: z.number().int(),
          // Empty allowed only when an attachment is present (checked below).
          content: z.string().max(1000).default(""),
          // Explicit kind is optional — the actual type is derived from what's
          // attached (docs/rfcs/0004 기능5).
          type: z.enum(["text", "image", "file"]).optional(),
          // Image message: ids from POST /upload/discussion-image (sender's own).
          imageIds: z
            .array(z.number().int())
            .max(MAX_MESSAGE_IMAGES)
            .optional(),
          // File message: ref returned by POST /upload/discussion-file.
          file: z
            .object({
              bucket: z.string().min(1),
              key: z.string().min(1),
              mime: z.string().min(1),
              size: z.number().int().nonnegative(),
              name: z.string().min(1),
            })
            .optional(),
        })
        .refine(
          (v) =>
            v.content.trim().length > 0 ||
            (v.imageIds?.length ?? 0) > 0 ||
            v.file !== undefined,
          { message: "내용 또는 첨부가 필요합니다." }
        )
    )
    .handler(async ({ context, input }) => {
      const result = await sendMessage({
        roomId: input.roomId,
        userId: context.session.user.id,
        content: input.content.trim(),
        imageIds: input.imageIds,
        file: input.file,
      });
      refreshRealtimeDiscussion("discussion.send");
      return {
        id: result.id,
        createdAt: result.createdAt.toISOString(),
      };
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.number().int() }))
    .handler(async ({ context, input }) => {
      await deleteMessage({
        messageId: input.messageId,
        actorUserId: context.session.user.id,
        actorRole: context.session.user.role ?? "user",
      });
      refreshRealtimeDiscussion("discussion.deleteMessage");
      return { ok: true };
    }),

  toggleLike: protectedProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(async ({ context, input }) => {
      const result = await toggleLike({
        roomId: input.roomId,
        userId: context.session.user.id,
      });
      refreshRealtimeDiscussion("discussion.toggleLike");
      return result;
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(
      async ({ context, input }) =>
        await toggleFavorite({
          roomId: input.roomId,
          userId: context.session.user.id,
        })
    ),

  /** Explicit leave — removes the user from `discussion_room_member`. */
  leaveRoom: protectedProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(async ({ context, input }) => {
      await db
        .delete(discussionRoomMember)
        .where(
          and(
            eq(discussionRoomMember.userId, context.session.user.id),
            eq(discussionRoomMember.roomId, input.roomId)
          )
        );
      refreshRealtimeDiscussion("discussion.leaveRoom");
      return { ok: true };
    }),

  // ── admin ─────────────────────────────────────────────────────────

  createRoom: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(200).default(""),
        stockCode: z.string().nullable().default(null),
        sentiment: sentimentSchema.default("neutral"),
      })
    )
    .handler(async ({ context, input }) => {
      const [room] = await db
        .insert(discussionRoom)
        .values({
          name: input.name.trim(),
          description: input.description.trim(),
          stockCode: input.stockCode,
          sentiment: input.sentiment,
          createdBy: context.session.user.id,
        })
        .returning({ id: discussionRoom.id });
      if (!room) {
        throw new Error("토론방 생성 실패");
      }
      refreshRealtimeDiscussion("discussion.createRoom");
      return { id: room.id };
    }),

  updateRoom: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(200).optional(),
        stockCode: z.string().nullable().optional(),
        sentiment: sentimentSchema.optional(),
      })
    )
    .handler(async ({ input }) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) {
        patch.name = input.name.trim();
      }
      if (input.description !== undefined) {
        patch.description = input.description.trim();
      }
      if (input.stockCode !== undefined) {
        patch.stockCode = input.stockCode;
      }
      if (input.sentiment !== undefined) {
        patch.sentiment = input.sentiment;
      }
      if (Object.keys(patch).length === 0) {
        return { ok: true };
      }
      await db
        .update(discussionRoom)
        .set(patch)
        .where(eq(discussionRoom.id, input.id));
      refreshRealtimeDiscussion("discussion.updateRoom");
      return { ok: true };
    }),

  deleteRoom: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(discussionRoom).where(eq(discussionRoom.id, input.id));
      refreshRealtimeDiscussion("discussion.deleteRoom");
      return { ok: true };
    }),

  /** Admin bulk blind (가림) — masks the selected messages for everyone. */
  hideMessages: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        messageIds: z.array(z.number().int()).min(1),
        reason: z.string().min(1).max(200),
      })
    )
    .handler(async ({ context, input }) => {
      await hideMessages({
        roomId: input.roomId,
        messageIds: input.messageIds,
        actorId: context.session.user.id,
        reason: input.reason.trim(),
      });
      refreshRealtimeDiscussion("discussion.hideMessages");
      return { ok: true };
    }),

  /** Admin bulk un-blind — restores the selected messages. */
  unhideMessages: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        messageIds: z.array(z.number().int()).min(1),
      })
    )
    .handler(async ({ input }) => {
      await unhideMessages({
        roomId: input.roomId,
        messageIds: input.messageIds,
      });
      refreshRealtimeDiscussion("discussion.unhideMessages");
      return { ok: true };
    }),

  /** Admin bulk soft-delete. */
  deleteMessages: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        messageIds: z.array(z.number().int()).min(1),
      })
    )
    .handler(async ({ input }) => {
      await deleteMessages({
        roomId: input.roomId,
        messageIds: input.messageIds,
      });
      refreshRealtimeDiscussion("discussion.deleteMessages");
      return { ok: true };
    }),

  /** Admin roster for the moderation panel — members + mute/block state. */
  roomMembers: adminProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(async ({ input }) => await roomMembers({ roomId: input.roomId })),

  /** Admin mute (뮤트) — value+unit, total capped at 1 day. */
  muteMember: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        userId: z.string(),
        value: z.number().int().min(1),
        unit: z.enum(["hour", "day"]),
      })
    )
    .handler(async ({ context, input }) => {
      await muteMember({
        roomId: input.roomId,
        userId: input.userId,
        hours: toHours(input.value, input.unit),
        actorId: context.session.user.id,
      });
      refreshRealtimeDiscussion("discussion.muteMember");
      return { ok: true };
    }),

  /** Admin unmute. */
  unmuteMember: adminProcedure
    .input(z.object({ roomId: z.number().int(), userId: z.string() }))
    .handler(async ({ input }) => {
      await unmuteMember({ roomId: input.roomId, userId: input.userId });
      refreshRealtimeDiscussion("discussion.unmuteMember");
      return { ok: true };
    }),

  /** Admin block (차단) — value+unit, total capped at 7 days. */
  blockMember: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        userId: z.string(),
        value: z.number().int().min(1),
        unit: z.enum(["hour", "day"]),
      })
    )
    .handler(async ({ context, input }) => {
      await blockMember({
        roomId: input.roomId,
        userId: input.userId,
        hours: toHours(input.value, input.unit),
        actorId: context.session.user.id,
      });
      refreshRealtimeDiscussion("discussion.blockMember");
      return { ok: true };
    }),

  /** Admin unblock. */
  unblockMember: adminProcedure
    .input(z.object({ roomId: z.number().int(), userId: z.string() }))
    .handler(async ({ input }) => {
      await unblockMember({ roomId: input.roomId, userId: input.userId });
      refreshRealtimeDiscussion("discussion.unblockMember");
      return { ok: true };
    }),
};

// Re-export domain functions so future ws handlers can call them without
// going through the RPC layer (docs/adr/0001 #4).
export const discussionDomain = {
  sendMessage,
  deleteMessage,
  hideMessages,
  unhideMessages,
  deleteMessages,
  toggleLike,
  toggleFavorite,
  roomMembers,
  muteMember,
  unmuteMember,
  blockMember,
  unblockMember,
};
