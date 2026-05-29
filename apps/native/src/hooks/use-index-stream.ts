import { env } from "@moneyroad-app/env/native";
import { useEffect, useState } from "react";
import EventSource from "react-native-sse";

import { authClient } from "@/lib/auth-client";
import { fetchStreamToken } from "@/lib/stream-token";
import type { MarketIndex } from "@/utils/data";

// 업종 구분 코드 ↔ 표시 이름. realtime은 코드로, IndexStrip은 이름으로 다룬다.
const INDEX_DEFS = [
  { code: "0001", name: "KOSPI" },
  { code: "1001", name: "KOSDAQ" },
] as const;
const INDEX_CODES = INDEX_DEFS.map((d) => d.code);
const KNOWN_CODES = new Set<string>(INDEX_CODES);

// 정규장 09:00~15:30. 차트 x축은 이 구간으로 고정한다.
const SESSION_OPEN_MIN = 9 * 60;
const SESSION_CLOSE_MIN = 15 * 60 + 30;
export const SESSION_MINUTES = SESSION_CLOSE_MIN - SESSION_OPEN_MIN;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export interface IndexPoint {
  m: number; // 장 시작 이후 경과 분 (0 ~ SESSION_MINUTES)
  v: number; // 해당 시점 지수값
}

export interface LiveIndex extends MarketIndex {
  prevClose: number;
  series: IndexPoint[];
}

interface QuoteEvent {
  change?: number;
  changeRate?: number;
  price: number;
  symbol: string;
  ts: number;
}

interface LiveState {
  byMinute: Record<number, number>;
  prevClose: number;
  value: number;
}

type SeedResponse = Record<string, { prevClose: number; points: IndexPoint[] }>;

// 현재 시각의 장중 경과 분(클램프). 디바이스 시계를 KST로 가정한다.
function liveMinute(): number {
  const now = new Date();
  const m = now.getHours() * 60 + now.getMinutes() - SESSION_OPEN_MIN;
  return Math.max(0, Math.min(SESSION_MINUTES, m));
}

/**
 * Drives the market-index strip: seeds today's intraday series (10-min candles)
 * from the realtime REST endpoint, then appends live SSE ticks per minute. Falls
 * back to the passed-in static indices until data arrives, and degrades to
 * live-tick-only (no morning history) if the seed is unavailable. Connects
 * whenever `EXPO_PUBLIC_REALTIME_URL` is set — indices are public so no token
 * is required; a stream token is attached when signed in.
 */
export function useIndexStream(fallback: MarketIndex[]): LiveIndex[] {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [live, setLive] = useState<Record<string, LiveState>>({});

  useEffect(() => {
    const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
    if (!baseUrl) {
      return;
    }

    let source: EventSource<"quote"> | null = null;
    let closed = false;
    let backoff = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReconnect = () => {
      if (closed || reconnectTimer) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, backoff);
      backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
    };

    const applySeed = (seed: SeedResponse) => {
      setLive((prev) => {
        const next = { ...prev };
        for (const { code } of INDEX_DEFS) {
          const s = seed[code];
          if (!s) {
            continue;
          }
          const byMinute: Record<number, number> = {};
          for (const p of s.points) {
            byMinute[p.m] = p.v;
          }
          const cur = prev[code];
          next[code] = {
            value: cur?.value || (s.points.at(-1)?.v ?? 0),
            prevClose: s.prevClose,
            // Live ticks that arrived before the seed take precedence per minute.
            byMinute: { ...byMinute, ...(cur?.byMinute ?? {}) },
          };
        }
        return next;
      });
    };

    const onQuote = (data: string | null) => {
      if (!data) {
        return;
      }
      let quote: QuoteEvent;
      try {
        quote = JSON.parse(data) as QuoteEvent;
      } catch {
        return;
      }
      if (!(KNOWN_CODES.has(quote.symbol) && typeof quote.price === "number")) {
        return;
      }
      setLive((prev) => {
        const cur = prev[quote.symbol];
        const prevClose =
          cur?.prevClose ||
          (quote.change == null ? quote.price : quote.price - quote.change);
        return {
          ...prev,
          [quote.symbol]: {
            value: quote.price,
            prevClose,
            byMinute: { ...(cur?.byMinute ?? {}), [liveMinute()]: quote.price },
          },
        };
      });
    };

    const fetchSeed = async (
      token: string | null
    ): Promise<SeedResponse | null> => {
      try {
        const params = new URLSearchParams({ symbols: INDEX_CODES.join(",") });
        if (token) {
          params.set("token", token);
        }
        const res = await fetch(`${baseUrl}/index/intraday?${params}`);
        if (!res.ok) {
          return null;
        }
        return (await res.json()) as SeedResponse;
      } catch {
        return null;
      }
    };

    const connect = async () => {
      if (closed) {
        return;
      }
      // Public indices stream without a token; signed-in users attach one so the
      // connection is attributed to them (and may include private symbols).
      const token = userId ? await fetchStreamToken() : null;
      if (closed) {
        return;
      }
      const seed = await fetchSeed(token);
      if (closed) {
        return;
      }
      if (seed) {
        applySeed(seed);
      }
      const params = new URLSearchParams({ symbols: INDEX_CODES.join(",") });
      if (token) {
        params.set("token", token);
      }
      // pollingInterval: 0 disables the library's auto-reconnect so we can
      // reconnect with a freshly-minted (unexpired) token ourselves.
      source = new EventSource<"quote">(
        `${baseUrl}/stream/quotes?${params.toString()}`,
        { pollingInterval: 0 }
      );
      source.addEventListener("open", () => {
        backoff = RECONNECT_BASE_MS;
      });
      source.addEventListener("quote", (event) => {
        onQuote("data" in event ? event.data : null);
      });
      source.addEventListener("error", () => {
        source?.removeAllEventListeners();
        source?.close();
        source = null;
        scheduleReconnect();
      });
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      source?.removeAllEventListeners();
      source?.close();
    };
  }, [userId]);

  return INDEX_DEFS.map(({ code, name }) => {
    const lv = live[code];
    const fb = fallback.find((i) => i.name === name);
    const series = lv
      ? Object.entries(lv.byMinute)
          .map(([m, v]) => ({ m: Number(m), v }))
          .sort((a, b) => a.m - b.m)
      : [];
    const value = lv?.value ?? fb?.value ?? 0;
    const prevClose = lv?.prevClose ?? (fb ? fb.value - fb.change : 0);
    // Derive change from value vs previous close so the number always matches
    // the chart baseline and never flashes 0 between seed load and first tick.
    const change = prevClose > 0 ? value - prevClose : (fb?.change ?? 0);
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return { name, value, change, changePct, prevClose, series };
  });
}
