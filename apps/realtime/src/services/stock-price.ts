import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";

import { getAccessToken } from "@/services/index-intraday";

const REST_URL = {
  prod: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
} as const;

const TR_PRICE = "FHKST01010100";
const PRICE_API = "/uapi/domestic-stock/v1/quotations/inquire-price";

const SNAPSHOT_TTL_MS = 5000;
const SNAPSHOT_CONCURRENCY = 5;

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
  const res = await fetch(`${REST_URL[env.KIS_ENV]}${PRICE_API}?${params}`, {
    headers: {
      authorization: `Bearer ${token}`,
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET,
      tr_id: TR_PRICE,
      custtype: "P",
    },
  });
  if (!res.ok) {
    log.warn({
      kis: { event: "price_snapshot", code, status: res.status, ok: false },
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

async function getCachedSnapshot(
  code: string,
  token: string
): Promise<PriceSnapshot | null> {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) {
    return hit.data;
  }
  const snap = await fetchPriceOnce(code, token);
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
  }
  return out;
}
