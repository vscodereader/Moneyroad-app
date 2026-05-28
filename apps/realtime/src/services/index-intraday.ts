import { env } from "@moneyroad-app/env/realtime";
import { createError, log } from "evlog";

// KIS REST 베이스 URL (체결 WS와 동일 호스트, REST는 https).
const REST_URL = {
  prod: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
} as const;

// 업종 분봉조회 TR. 시장 U(업종), 10분봉(600)으로 당일 전 구간을 한 번에 받는다.
const TR_INDEX_CHART = "FHKUP03500200";
const CHART_API =
  "/uapi/domestic-stock/v1/quotations/inquire-time-indexchartprice";
const CHART_INTERVAL = "600"; // 600초 = 10분봉 (39포인트 ≈ 09:00~15:30 단일 페이지)

// 세션 기준(분). 09:00 = 540, 15:30 = 930.
const SESSION_OPEN_MIN = 9 * 60;
const SESSION_CLOSE_MIN = 15 * 60 + 30;
export const SESSION_MINUTES = SESSION_CLOSE_MIN - SESSION_OPEN_MIN;

// 액세스 토큰 만료 여유(만료 1분 전부터 재발급).
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export interface IndexPoint {
  m: number; // 장 시작 이후 경과 분 (0 ~ SESSION_MINUTES)
  v: number; // 해당 시점 지수값
}

export interface IndexIntraday {
  points: IndexPoint[];
  prevClose: number;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

async function requestToken(): Promise<string> {
  const res = await fetch(`${REST_URL[env.KIS_ENV]}/oauth2/tokenP`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: env.KIS_APP_KEY,
      appsecret: env.KIS_APP_SECRET,
    }),
  });
  if (!res.ok) {
    throw createError({
      message: "KIS REST token request failed",
      status: 502,
      why: `KIS /oauth2/tokenP responded ${res.status}`,
      fix: "Verify KIS credentials and KIS_ENV",
      internal: { status: res.status, kisEnv: env.KIS_ENV },
    });
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw createError({
      message: "KIS REST token missing",
      status: 502,
      why: "tokenP response did not include access_token",
      fix: "Check KIS API status and credentials",
    });
  }
  const ttlMs = (json.expires_in ?? 86_400) * 1000;
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + ttlMs - TOKEN_EXPIRY_MARGIN_MS,
  };
  return json.access_token;
}

// KIS는 tokenP 발급을 분당 1회로 제한하므로 토큰을 캐시하고, 동시 요청은 단일
// in-flight 프로미스로 합친다.
function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return Promise.resolve(cachedToken.value);
  }
  if (!tokenInFlight) {
    tokenInFlight = requestToken().finally(() => {
      tokenInFlight = null;
    });
  }
  return tokenInFlight;
}

function toMinute(hhmmss: string): number {
  const hour = Number(hhmmss.slice(0, 2));
  const minute = Number(hhmmss.slice(2, 4));
  return hour * 60 + minute - SESSION_OPEN_MIN;
}

interface ChartRow {
  bstp_nmix_prpr?: string;
  stck_cntg_hour?: string;
}

/**
 * Fetches today's intraday index series (10-min candles) for one 업종 code via
 * the KIS REST chart API. Returns the previous close (for the baseline) and the
 * session points oldest-first. Returns null on any failure so the caller can
 * fall back to live-tick accumulation (e.g. when paper/VTS blocks the endpoint).
 */
export async function fetchIndexIntraday(
  code: string
): Promise<IndexIntraday | null> {
  if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
    return null;
  }
  try {
    const token = await getAccessToken();
    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: "U",
      FID_ETC_CLS_CODE: "0",
      FID_INPUT_ISCD: code,
      FID_INPUT_HOUR_1: CHART_INTERVAL,
      FID_PW_DATA_INCU_YN: "N",
    });
    const res = await fetch(`${REST_URL[env.KIS_ENV]}${CHART_API}?${params}`, {
      headers: {
        authorization: `Bearer ${token}`,
        appkey: env.KIS_APP_KEY,
        appsecret: env.KIS_APP_SECRET,
        tr_id: TR_INDEX_CHART,
        custtype: "P",
      },
    });
    if (!res.ok) {
      log.warn({
        kis: { event: "intraday", code, status: res.status, ok: false },
      });
      return null;
    }
    const body = (await res.json()) as {
      rt_cd?: string;
      output1?: { prdy_nmix?: string };
      output2?: ChartRow[];
    };
    if (body.rt_cd !== "0" || !body.output2) {
      return null;
    }
    const prevClose = Number(body.output1?.prdy_nmix);
    const points: IndexPoint[] = [];
    // KIS는 최신순으로 내려주므로 역순으로 채워 오래된→최신 정렬.
    for (let i = body.output2.length - 1; i >= 0; i -= 1) {
      const row = body.output2[i];
      if (!row?.stck_cntg_hour) {
        continue;
      }
      const value = Number(row.bstp_nmix_prpr);
      const m = toMinute(row.stck_cntg_hour);
      if (!(Number.isNaN(value) || Number.isNaN(m)) && m >= 0) {
        points.push({ m, v: value });
      }
    }
    return { prevClose: Number.isNaN(prevClose) ? 0 : prevClose, points };
  } catch (error) {
    log.warn({ kis: { event: "intraday", code, ok: false }, error });
    return null;
  }
}
