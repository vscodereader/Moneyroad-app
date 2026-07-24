import { db } from "@moneyroad-app/db";
import {
  discussionMessage,
  discussionRoom,
  discussionRoomFavorite,
  discussionRoomLike,
  discussionRoomMember,
  stockMaster,
  user,
  userWatchlist,
} from "@moneyroad-app/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, isNull, lt, type SQL, sql } from "drizzle-orm";
import z from "zod";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";

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
    repliesCount: sql<number>`(SELECT COUNT(*)::int FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${roomIdRef})`,
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

// ── domain functions (transport-agnostic, see docs/adr/0001 #4) ──────

/**
 * Insert a message. First send into a room implicitly joins the user
 * (docs/adr/0002). Future ws handlers call this same function.
 */
async function sendMessage(args: {
  roomId: number;
  userId: string;
  content: string;
}): Promise<{ id: number; createdAt: Date }> {
  const room = await db
    .select({ id: discussionRoom.id })
    .from(discussionRoom)
    .where(eq(discussionRoom.id, args.roomId))
    .limit(1);
  if (room.length === 0) {
    throw new ORPCError("NOT_FOUND", { message: "토론방이 없습니다." });
  }

  // Implicit join.
  await db
    .insert(discussionRoomMember)
    .values({ userId: args.userId, roomId: args.roomId })
    .onConflictDoNothing();

  const [row] = await db
    .insert(discussionMessage)
    .values({
      roomId: args.roomId,
      userId: args.userId,
      content: args.content,
    })
    .returning({
      id: discussionMessage.id,
      createdAt: discussionMessage.createdAt,
    });

  if (!row) {
    throw new Error("메시지 저장 실패");
  }
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
          createdAt: discussionMessage.createdAt,
          deletedAt: discussionMessage.deletedAt,
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

      return {
        messages: slice.map((m) => ({
          id: m.id,
          userId: m.userId,
          userName: m.userName,
          userImage: m.userImage,
          content: m.deletedAt ? null : m.content,
          createdAt: m.createdAt.toISOString(),
          deletedAt: m.deletedAt?.toISOString() ?? null,
        })),
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
      z.object({
        roomId: z.number().int(),
        content: z.string().min(1).max(1000),
      })
    )
    .handler(async ({ context, input }) => {
      const result = await sendMessage({
        roomId: input.roomId,
        userId: context.session.user.id,
        content: input.content.trim(),
      });
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
      return { ok: true };
    }),

  toggleLike: protectedProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(
      async ({ context, input }) =>
        await toggleLike({
          roomId: input.roomId,
          userId: context.session.user.id,
        })
    ),

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
      return { ok: true };
    }),

  deleteRoom: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(discussionRoom).where(eq(discussionRoom.id, input.id));
      return { ok: true };
    }),
};

// Re-export domain functions so future ws handlers can call them without
// going through the RPC layer (docs/adr/0001 #4).
export const discussionDomain = {
  sendMessage,
  deleteMessage,
  toggleLike,
  toggleFavorite,
};
