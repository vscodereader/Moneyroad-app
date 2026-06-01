import { env } from "@moneyroad-app/env/native";
import { useEffect, useState } from "react";
import EventSource from "react-native-sse";

import { authClient } from "@/lib/auth-client";
import { fetchStreamToken } from "@/lib/stream-token";

export interface LiveQuote {
  change: number;
  changeRate: number;
  price: number;
  ts: number;
}

interface QuoteEvent {
  change?: number;
  changeRate?: number;
  price: number;
  symbol: string;
  ts: number;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

async function fetchSnapshotSeed(
  baseUrl: string,
  symbolsKey: string,
  token: string
): Promise<Record<string, LiveQuote>> {
  try {
    const params = new URLSearchParams({ symbols: symbolsKey, token });
    const res = await fetch(`${baseUrl}/quote/snapshot?${params}`);
    if (!res.ok) {
      return {};
    }
    return (await res.json()) as Record<string, LiveQuote>;
  } catch {
    return {};
  }
}

/**
 * Subscribes to the realtime `/stream/quotes` SSE for the given symbols and
 * returns a `symbol → LiveQuote` map updated per tick. On (re)connect the hook
 * also fetches `/quote/snapshot` as a seed so the UI shows the last-known price
 * immediately and keeps showing it when WS ticks aren't flowing (off hours,
 * 동시호가, just-connected client). SSE ticks always win — the seed only fills
 * symbols that don't already have a live tick to avoid stomping fresher data.
 * Individual symbols are private, so a stream token is attached and the hook
 * short-circuits when the user is not signed in or the symbol list is empty.
 * Reconnect uses an exponential backoff and mints a fresh token each attempt.
 */
export function useQuoteStream(symbols: string[]): Record<string, LiveQuote> {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  // 정렬 후 join하여 useEffect 의존성을 안정화한다(같은 셋이면 재연결 안 함).
  const symbolsKey = symbols.slice().sort().join(",");

  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});

  useEffect(() => {
    const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
    if (!(baseUrl && userId && symbolsKey)) {
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

    const applySeed = (seed: Record<string, LiveQuote>) => {
      setQuotes((prev) => {
        const next = { ...prev };
        for (const [sym, q] of Object.entries(seed)) {
          // SSE 라이브 틱이 이미 있으면 그걸 유지(시드는 더 오래된 값).
          if (!next[sym]) {
            next[sym] = q;
          }
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
      if (!(quote.symbol && typeof quote.price === "number")) {
        return;
      }
      setQuotes((prev) => ({
        ...prev,
        [quote.symbol]: {
          change: quote.change ?? 0,
          changeRate: quote.changeRate ?? 0,
          price: quote.price,
          ts: quote.ts,
        },
      }));
    };

    const connect = async () => {
      if (closed) {
        return;
      }
      const token = await fetchStreamToken();
      if (closed || !token) {
        scheduleReconnect();
        return;
      }
      // 시드와 SSE는 독립적으로 진행. 시드가 늦게 도착하더라도 SSE가 먼저 채운
      // 값은 applySeed가 덮어쓰지 않으므로 순서 경합은 안전.
      fetchSnapshotSeed(baseUrl, symbolsKey, token).then((seed) => {
        if (!closed) {
          applySeed(seed);
        }
      });
      const params = new URLSearchParams({ symbols: symbolsKey, token });
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
  }, [userId, symbolsKey]);

  return quotes;
}
