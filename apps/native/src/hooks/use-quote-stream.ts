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

/**
 * Subscribes to the realtime `/stream/quotes` SSE for the given symbols and
 * returns a `symbol → LiveQuote` map updated per tick. Individual symbols are
 * private, so a stream token is attached and the hook short-circuits when the
 * user is not signed in or the symbol list is empty. Reconnect uses an
 * exponential backoff and mints a fresh token each attempt so the 120s TTL
 * never bites mid-session.
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
