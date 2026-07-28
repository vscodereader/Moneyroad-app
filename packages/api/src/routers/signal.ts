import { db } from "@moneyroad-app/db";
import { signal, stockMaster, userWatchlist } from "@moneyroad-app/db/schema";
import { and, count, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import z from "zod";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";
import {
  refreshRealtimePins,
  refreshRealtimeSignal,
} from "../lib/realtime-trigger";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DAY_MS = 86_400_000;

const actionSchema = z.enum(["buy", "sell", "hold"]);
// 시그널은 관리자가 삭제하기 전까지 노출된다. 시간 윈도우는 기본적으로 무제한.
const windowSchema = z.enum(["24h", "7d", "all"]).default("all");

type Action = z.infer<typeof actionSchema>;
type Window = z.infer<typeof windowSchema>;

// Screen-facing item shape (mirrors apps/native Signal).
export interface SignalItem {
  action: Action;
  body: string;
  code: string;
  id: string;
  name: string;
  source: (typeof signal.$inferSelect)["source"];
  strength: number;
  time: string;
  title: string;
}

// Window → cutoff date (null = no time bound).
function sinceOf(window: Window): Date | null {
  if (window === "all") {
    return null;
  }
  const days = window === "7d" ? 7 : 1;
  return new Date(Date.now() - days * DAY_MS);
}

// 시그널은 삭제 전까지 장기 노출되므로 상대시간("N시간 전") 대신
// 등록 날짜(KST)를 "YYYY.MM.DD" 형태로 보여준다.
const signalDateFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatSignalDate(date: Date): string {
  const parts = signalDateFmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

/** Stock code → name for the given codes (one round trip). */
async function stockNames(codes: string[]): Promise<Map<string, string>> {
  if (codes.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({ code: stockMaster.mkscShrnIscd, name: stockMaster.htsKorIsnm })
    .from(stockMaster)
    .where(inArray(stockMaster.mkscShrnIscd, codes));
  return new Map(rows.map((r) => [r.code, r.name]));
}

export const signalRouter = {
  // Global signal feed, newest first, optionally filtered by action/window.
  feed: publicProcedure
    .input(
      z.object({
        action: actionSchema.optional(),
        // Limit to one stock (used by the stock detail screen).
        code: z.string().optional(),
        window: windowSchema,
        // Keyset cursor: createdAt (ISO) of the last item from the prev page.
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
      })
    )
    .handler(async ({ input }) => {
      const filters: SQL[] = [];
      const since = sinceOf(input.window);
      if (since) {
        filters.push(gte(signal.createdAt, since));
      }
      if (input.action) {
        filters.push(eq(signal.action, input.action));
      }
      if (input.code) {
        filters.push(eq(signal.stockCode, input.code));
      }
      if (input.cursor) {
        const cursorDate = new Date(input.cursor);
        if (!Number.isNaN(cursorDate.getTime())) {
          filters.push(lt(signal.createdAt, cursorDate));
        }
      }

      const rows = await db
        .select({
          id: signal.id,
          code: signal.stockCode,
          action: signal.action,
          source: signal.source,
          strength: signal.strength,
          title: signal.title,
          body: signal.body,
          createdAt: signal.createdAt,
        })
        .from(signal)
        .where(filters.length > 0 ? and(...filters) : undefined)
        .orderBy(desc(signal.createdAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const names = await stockNames([...new Set(page.map((r) => r.code))]);

      const items: SignalItem[] = page.map((r) => ({
        id: r.id,
        code: r.code,
        action: r.action,
        source: r.source,
        strength: r.strength,
        title: r.title,
        body: r.body,
        name: names.get(r.code) ?? r.code,
        time: formatSignalDate(r.createdAt),
      }));
      const last = page.at(-1);
      const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
      return { items, nextCursor };
    }),

  // Per-action counts within the window (for the filter chips).
  counts: publicProcedure
    .input(z.object({ window: windowSchema }))
    .handler(async ({ input }) => {
      const since = sinceOf(input.window);
      const rows = await db
        .select({ action: signal.action, n: count() })
        .from(signal)
        .where(since ? gte(signal.createdAt, since) : undefined)
        .groupBy(signal.action);

      const result = { all: 0, buy: 0, sell: 0, hold: 0 };
      for (const r of rows) {
        result[r.action] = r.n;
        result.all += r.n;
      }
      return result;
    }),

  // Admin: manually register a signal. source is fixed to "community" since
  // engine-derived signals are "tech"; manual entries come from the admin team.
  create: adminProcedure
    .input(
      z.object({
        stockCode: z.string().min(1),
        action: actionSchema,
        strength: z.number().int().min(1).max(5),
        title: z.string().min(1).max(80),
        body: z.string().min(1).max(500),
      })
    )
    .handler(async ({ input }) => {
      const [row] = await db
        .insert(signal)
        .values({
          stockCode: input.stockCode,
          action: input.action,
          source: "community",
          strength: input.strength,
          title: input.title.trim(),
          body: input.body.trim(),
        })
        .returning({ id: signal.id });
      if (!row) {
        throw new Error("시그널 생성 실패");
      }
      // New signal stock → tell realtime to pin/whitelist it now (not in ~10s).
      refreshRealtimePins("signal.create");
      // ----(시그널 목록 실시간 갱신)----
      // 위 pins 갱신은 "이 종목 시세를 흘려보내라"까지만 한다. 목록 화면을 다시
      // 불러오게 하려면 별도 broadcast가 필요하다 — 이게 없어서 관리자가 시그널을
      // 추가해도 유저 화면이 그대로였다.
      refreshRealtimeSignal("signal.create");
      // ----(끝)----
      return { id: row.id };
    }),

  // Admin: delete a signal. Signals stay visible until removed, so this is the
  // counterpart to create — used by the admin manage screen.
  remove: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ input }) => {
      await db.delete(signal).where(eq(signal.id, input.id));
      // Stock may no longer be referenced → let realtime drop the pin promptly.
      refreshRealtimePins("signal.remove");
      // ----(시그널 목록 실시간 갱신)----
      refreshRealtimeSignal("signal.remove");
      // ----(끝)----
      return { ok: true };
    }),

  // Count of signals on the current user's watched stocks in the last 24h.
  activeCount: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const watched = await db
      .selectDistinct({ code: userWatchlist.stockCode })
      .from(userWatchlist)
      .where(eq(userWatchlist.userId, userId));
    const codes = watched.map((w) => w.code);
    if (codes.length === 0) {
      return 0;
    }
    const [row] = await db
      .select({ n: count() })
      .from(signal)
      .where(
        and(
          inArray(signal.stockCode, codes),
          gte(signal.createdAt, new Date(Date.now() - DAY_MS))
        )
      );
    return row?.n ?? 0;
  }),
};
