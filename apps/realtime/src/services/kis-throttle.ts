import { env } from "@moneyroad-app/env/realtime";

// KIS REST 호출 사이 최소 간격(ms).
// paper(모의)는 실제로 초당 1회 한도에 가까워 600ms로도 EGW00201이 자주 떨어진다.
// 1.1초 간격으로 보수적으로 잡고, prod는 한도가 후하니 100ms.
const MIN_INTERVAL_MS = env.KIS_ENV === "paper" ? 1100 : 100;

let lastCallAt = 0;
let chain: Promise<unknown> = Promise.resolve();

/**
 * Serializes all KIS REST calls through a single chain and enforces a minimum
 * gap between consecutive calls so concurrent endpoints (intraday + snapshot +
 * chart) can't collectively bust the upstream rate limit. Use to wrap the
 * `fetch(...)` call only — JSON parsing afterwards is irrelevant to the limit.
 */
export function throttledKisCall<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastCallAt = Date.now();
    return fn();
  };
  // 한 호출이 실패해도 큐는 끊기지 않도록 catch로 흡수.
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}
