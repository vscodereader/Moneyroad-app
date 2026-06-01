import { env } from "@moneyroad-app/env/native";
import EventSource from "react-native-sse";

import { fetchStreamToken } from "@/lib/stream-token";
import { type LiveQuote, useQuotesStore } from "@/stores/quotes-store";

interface QuoteEvent {
  change?: number;
  changeRate?: number;
  price: number;
  symbol: string;
  ts: number;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
// 짧은 시간 안에 여러 register/unregister가 일어날 때 즉시 재연결하지 않고
// 한 번에 합쳐 처리해 setup overhead와 KIS 부담을 줄인다.
const RECONNECT_DEBOUNCE_MS = 150;

let userId: string | null = null;
let activeSymbols: string[] = [];
let source: EventSource<"quote"> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = RECONNECT_BASE_MS;
let unsubStore: (() => void) | null = null;
let started = false;

function closeSource(): void {
  if (source) {
    source.removeAllEventListeners();
    source.close();
    source = null;
  }
}

async function fetchSeed(
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

function onQuote(data: string | null): void {
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
  useQuotesStore.getState().applyTick(quote.symbol, {
    change: quote.change ?? 0,
    changeRate: quote.changeRate ?? 0,
    price: quote.price,
    ts: quote.ts,
  });
}

async function connect(symbolsKey: string): Promise<void> {
  const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
  if (!(baseUrl && userId && symbolsKey)) {
    return;
  }
  const token = await fetchStreamToken();
  if (!token) {
    return;
  }
  // 연결 시도 도중 activeSymbols가 바뀌었으면 이번 시도는 폐기.
  if (symbolsKey !== activeSymbols.join(",")) {
    return;
  }
  // 시드와 SSE를 병렬로 — applySeed는 라이브 틱을 덮어쓰지 않으므로 순서 안전.
  fetchSeed(baseUrl, symbolsKey, token).then((seed) => {
    if (Object.keys(seed).length > 0) {
      useQuotesStore.getState().applySeed(seed);
    }
  });
  const params = new URLSearchParams({ symbols: symbolsKey, token });
  const next = new EventSource<"quote">(
    `${baseUrl}/stream/quotes?${params.toString()}`,
    { pollingInterval: 0 }
  );
  next.addEventListener("open", () => {
    backoff = RECONNECT_BASE_MS;
  });
  next.addEventListener("quote", (event) => {
    onQuote("data" in event ? event.data : null);
  });
  next.addEventListener("error", () => {
    closeSource();
    scheduleReconnect();
  });
  closeSource();
  source = next;
}

function scheduleReconnect(): void {
  if (backoffTimer) {
    return;
  }
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    triggerReconnect();
  }, backoff);
  backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
}

function triggerReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    const symbolsKey = activeSymbols.join(",");
    if (!symbolsKey) {
      closeSource();
      return;
    }
    connect(symbolsKey);
  }, RECONNECT_DEBOUNCE_MS);
}

function handleActiveChange(next: string[], prev: string[]): void {
  if (next === prev) {
    return;
  }
  activeSymbols = next;
  triggerReconnect();
}

/**
 * Starts the singleton SSE pipeline backing the Zustand quotes store. Idempotent
 * — call once on app mount. When `activeSymbols` changes (register/unregister
 * via the store) the connection is re-established with the new symbol set.
 * Without a signed-in user the manager stays idle.
 */
export function startQuotesManager(getUserId: () => string | null): () => void {
  if (started) {
    return () => undefined;
  }
  started = true;
  userId = getUserId();
  activeSymbols = useQuotesStore.getState().activeSymbols;
  unsubStore = useQuotesStore.subscribe((state, prev) => {
    handleActiveChange(state.activeSymbols, prev.activeSymbols);
  });
  if (userId && activeSymbols.length > 0) {
    triggerReconnect();
  }
  return () => {
    started = false;
    unsubStore?.();
    unsubStore = null;
    closeSource();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    userId = null;
  };
}

/**
 * Updates the user the manager is operating as. Pass null when signed out to
 * close the SSE and stop trying to reconnect; pass a user id to (re)start with
 * the current active symbol set.
 */
export function setQuotesManagerUser(next: string | null): void {
  if (userId === next) {
    return;
  }
  userId = next;
  if (!next) {
    closeSource();
    useQuotesStore.getState().clear();
    return;
  }
  triggerReconnect();
}
