import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";

import { getAccessToken } from "@/services/index-intraday";
import { throttledKisCall } from "@/services/kis-throttle";

const REST_URL = {
  prod: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
} as const;

const TR_PRICE = "FHKST01010100";
const PRICE_API = "/uapi/domestic-stock/v1/quotations/inquire-price";

const SNAPSHOT_TTL_MS = 5000;
// KIS paper는 초당 호출 한도가 엄격해 EGW00201("초당 거래건수 초과")이 잦다.
// concurrency 1 + 호출 간 throttle 250ms로 안전 마진을 확보한다.
const SNAPSHOT_CONCURRENCY = 1;
const SNAPSHOT_THROTTLE_MS = 250;
// rate-limit(EGW00201) 회복은 1초 정도면 충분. 일반 일시적 5xx도 같이 흡수.
const SNAPSHOT_RETRY_DELAY_MS = 1000;
// 본문은 KIS msg_cd/msg1을 담고 있어 원인 파악에 필수지만, 길이 폭주는 막는다.
const ERROR_BODY_MAX = 300;

// Shape matches the client's LiveQuote so the SSE and snapshot paths share the
// same consumer (no conversion). Volume is intentionally omitted — clients only
// use price/change/changeRate/ts.
export interface PriceSnapshot {
  change: number;
  changeRate: number;
  price: number;
  ts: number;
}

interface CacheEntry {
  at: number;
  data: PriceSnapshot | null;
}

const cache = new Map<string, CacheEntry>();

interface PriceOutput {
  acml_vol?: string;
  prdy_ctrt?: string;
  prdy_vrss?: string;
  prdy_vrss_sign?: string;
  stck_prpr?: string;
}

// KIS sends magnitudes unsigned with a sign code (1상한 2상승 3보합 4하한 5하락).
function signed(magnitude: number, sign: string | undefined): number {
  if (Number.isNaN(magnitude)) {
    return 0;
  }
  const negative = sign === "4" || sign === "5";
  return negative ? -Math.abs(magnitude) : Math.abs(magnitude);
}

async function fetchPriceOnce(
  code: string,
  token: string
): Promise<PriceSnapshot | null> {
  if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
    return null;
  }
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: code,
  });
  const res = await throttledKisCall(() =>
    fetch(`${REST_URL[env.KIS_ENV]}${PRICE_API}?${params}`, {
      headers: {
        authorization: `Bearer ${token}`,
        appkey: env.KIS_APP_KEY,
        appsecret: env.KIS_APP_SECRET,
        tr_id: TR_PRICE,
        custtype: "P",
      },
    })
  );
  if (!res.ok) {
    let body = "";
    try {
      body = (await res.text()).slice(0, ERROR_BODY_MAX);
    } catch {
      // 본문 읽기 실패는 무시 — status만으로도 가치 있음.
    }
    log.warn({
      kis: {
        body,
        code,
        event: "price_snapshot",
        ok: false,
        status: res.status,
      },
    });
    return null;
  }
  const body = (await res.json()) as {
    output?: PriceOutput;
    rt_cd?: string;
  };
  if (body.rt_cd !== "0" || !body.output) {
    return null;
  }
  const o = body.output;
  const price = Number(o.stck_prpr);
  if (Number.isNaN(price) || price <= 0) {
    return null;
  }
  const sign = o.prdy_vrss_sign;
  return {
    price,
    change: signed(Number(o.prdy_vrss), sign),
    changeRate: signed(Number(o.prdy_ctrt), sign),
    ts: Date.now(),
  };
}

async function fetchPriceRetry(
  code: string,
  token: string
): Promise<PriceSnapshot | null> {
  const first = await fetchPriceOnce(code, token);
  if (first) {
    return first;
  }
  // KIS가 일시적으로 500을 떨구는 경우가 있어 짧게 1회 재시도.
  await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_RETRY_DELAY_MS));
  return fetchPriceOnce(code, token);
}

async function getCachedSnapshot(
  code: string,
  token: string
): Promise<PriceSnapshot | null> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) {
    return hit.data;
  }
  const snap = await fetchPriceRetry(code, token);
  cache.set(code, { at: Date.now(), data: snap });
  return snap;
}

/**
 * Fetches last-known price snapshots for the requested codes via KIS
 * `inquire-price`. Used as a seed when WebSocket ticks aren't flowing (off
 * hours, 동시호가, just-connected client) — pairs with the `/stream/quotes` SSE
 * so the client renders something immediately rather than placeholders.
 * Returns oldest→newest is irrelevant here; result keyed by code.
 */
export async function fetchStockSnapshots(
  codes: string[]
): Promise<Record<string, PriceSnapshot>> {
  if (codes.length === 0 || !(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
    return {};
  }
  let token: string;
  try {
    token = await getAccessToken();
  } catch (error) {
    log.warn({ kis: { event: "price_snapshot_token", ok: false }, error });
    return {};
  }
  const out: Record<string, PriceSnapshot> = {};
  for (let i = 0; i < codes.length; i += SNAPSHOT_CONCURRENCY) {
    const slice = codes.slice(i, i + SNAPSHOT_CONCURRENCY);
    const batch = await Promise.all(
      slice.map((code) =>
        getCachedSnapshot(code, token).then((snap) => ({ code, snap }))
      )
    );
    for (const { code, snap } of batch) {
      if (snap) {
        out[code] = snap;
      }
    }
    // 다음 chunk 전 짧은 throttle — KIS paper의 초당 한도(EGW00201) 회피.
    if (i + SNAPSHOT_CONCURRENCY < codes.length) {
      await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_THROTTLE_MS));
    }
  }
  return out;
}
