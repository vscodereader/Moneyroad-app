import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";

import { getAccessToken } from "@/services/index-intraday";
import { throttledKisCall } from "@/services/kis-throttle";

const REST_URL = {
  prod: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
} as const;

// 일별 분봉 (1D) — 1회 호출 120건, 과거 분봉도 조회 가능. 같은 1분봉 데이터지만
// 페이지 크기가 커서 09:00~15:30 전체를 4회 호출이면 채울 수 있다.
const TR_MINUTE = "FHKST03010230";
const MINUTE_API =
  "/uapi/domestic-stock/v1/quotations/inquire-time-dailychartprice";

// 기간별 시세 (D/W/M/Y) — 1회 호출 최대 100건.
const TR_DAILY = "FHKST03010100";
const DAILY_API =
  "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice";

export const CHART_RANGES = ["1D", "3M", "1Y", "3Y"] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

const VALID_RANGES: ReadonlySet<string> = new Set(CHART_RANGES);

export function isChartRange(value: string): value is ChartRange {
  return VALID_RANGES.has(value);
}

export interface ChartPoint {
  /** 1D: 09:00 기준 경과 분(0~390). 그 외: 0..length-1 인덱스. */
  t: number;
  v: number;
  vol: number;
}

export interface ChartSeries {
  points: ChartPoint[];
  prevClose: number;
}

// 분봉은 분 단위로만 갱신되므로 짧게, 일봉은 장중 갱신이 드물어 길게.
const MINUTE_TTL_MS = 30_000;
const DAILY_TTL_MS = 60 * 60_000;

// 정규장 09:00~15:30 = 390분. 1D 차트의 X축 상한이자 시간→분 변환의 기준점.
const SESSION_OPEN_MIN = 9 * 60;
const SESSION_CLOSE_MIN = 15 * 60 + 30;
// 일별 분봉 API는 1회 호출당 최대 120개(=120분, 1분봉) 반환. 종료시각을 120분씩
// backward로 옮겨 09:00~현재까지 4회 안팎으로 채운다.
const MINUTE_PAGE_STEP = 120;
// 페이지 수가 적어졌지만 KIS 5xx 가능성에 대비해 동시성/재시도는 유지.
const MINUTE_CONCURRENCY = 5;
const MINUTE_RETRY_DELAY_MS = 300;

interface DailyPlan {
  period: "D" | "M" | "W";
  spanDays: number;
}

const DAILY_PLAN: Record<Exclude<ChartRange, "1D">, DailyPlan> = {
  // 3개월: 일봉(D), ~66 거래일. 100건 한도 내.
  "3M": { spanDays: 100, period: "D" },
  // 1년: 주봉(W), ~52주. 일봉으론 ~252개라 100건 한도 초과.
  "1Y": { spanDays: 380, period: "W" },
  // 3년: 월봉(M), ~36개월. 주봉으론 ~156개라 한도 초과.
  "3Y": { spanDays: 1200, period: "M" },
};

interface CacheEntry {
  at: number;
  series: ChartSeries;
}

const EMPTY: ChartSeries = { points: [], prevClose: 0 };
const cache = new Map<string, CacheEntry>();

function ttlFor(range: ChartRange): number {
  return range === "1D" ? MINUTE_TTL_MS : DAILY_TTL_MS;
}

function formatYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseHourToMinute(hhmmss: string | undefined): number | null {
  if (!hhmmss || hhmmss.length < 4) {
    return null;
  }
  const hour = Number(hhmmss.slice(0, 2));
  const minute = Number(hhmmss.slice(2, 4));
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  return hour * 60 + minute - SESSION_OPEN_MIN;
}

interface MinuteRow {
  cntg_vol?: string;
  stck_cntg_hour?: string;
  stck_prpr?: string;
}

interface MinuteOutput1 {
  stck_prdy_clpr?: string;
}

interface DailyRow {
  acml_vol?: string;
  stck_clpr?: string;
}

interface DailyOutput1 {
  stck_prdy_clpr?: string;
}

function formatMinuteOfDay(m: number): string {
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}${mm}00`;
}

interface MinutePage {
  points: ChartPoint[];
  prevClose: number;
}

async function fetchMinutePage(
  code: string,
  hhmmss: string,
  yyyymmdd: string,
  token: string
): Promise<MinutePage | null> {
  if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
    return null;
  }
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: code,
    FID_INPUT_HOUR_1: hhmmss,
    FID_INPUT_DATE_1: yyyymmdd,
    FID_PW_DATA_INCU_YN: "N",
    FID_FAKE_TICK_INCU_YN: "",
  });
  const res = await throttledKisCall(() =>
    fetch(`${REST_URL[env.KIS_ENV]}${MINUTE_API}?${params}`, {
      headers: {
        authorization: `Bearer ${token}`,
        appkey: env.KIS_APP_KEY,
        appsecret: env.KIS_APP_SECRET,
        tr_id: TR_MINUTE,
        custtype: "P",
      },
    })
  );
  if (!res.ok) {
    log.warn({
      kis: {
        event: "chart_minute_page",
        code,
        hhmmss,
        status: res.status,
        ok: false,
      },
    });
    return null;
  }
  const body = (await res.json()) as {
    output1?: MinuteOutput1;
    output2?: MinuteRow[];
    rt_cd?: string;
  };
  if (body.rt_cd !== "0" || !body.output2) {
    return null;
  }
  const prevClose = Number(body.output1?.stck_prdy_clpr ?? 0);
  const points: ChartPoint[] = [];
  // KIS는 최신순으로 내려주므로 역순으로 채워 오래된→최신 정렬.
  for (let i = body.output2.length - 1; i >= 0; i -= 1) {
    const row = body.output2[i];
    const t = parseHourToMinute(row?.stck_cntg_hour);
    const v = Number(row?.stck_prpr);
    const vol = Number(row?.cntg_vol);
    if (t == null || t < 0 || Number.isNaN(v) || v <= 0) {
      continue;
    }
    points.push({ t, v, vol: Number.isNaN(vol) ? 0 : vol });
  }
  return { points, prevClose: Number.isNaN(prevClose) ? 0 : prevClose };
}

async function fetchMinutePageRetry(
  code: string,
  hhmmss: string,
  yyyymmdd: string,
  token: string
): Promise<MinutePage | null> {
  const first = await fetchMinutePage(code, hhmmss, yyyymmdd, token);
  if (first) {
    return first;
  }
  // KIS가 동시 호출 일부를 일시적으로 거부하는 경우가 잦아 1회 짧게 재시도.
  await new Promise((resolve) => setTimeout(resolve, MINUTE_RETRY_DELAY_MS));
  return fetchMinutePage(code, hhmmss, yyyymmdd, token);
}

async function fetchMinutePages(
  code: string,
  marks: number[],
  yyyymmdd: string,
  token: string
): Promise<(MinutePage | null)[]> {
  const pages: (MinutePage | null)[] = [];
  for (let i = 0; i < marks.length; i += MINUTE_CONCURRENCY) {
    const slice = marks.slice(i, i + MINUTE_CONCURRENCY);
    const batch = await Promise.all(
      slice.map((m) =>
        fetchMinutePageRetry(code, formatMinuteOfDay(m), yyyymmdd, token)
      )
    );
    pages.push(...batch);
  }
  return pages;
}

function minuteEndMarks(nowMin: number): number[] {
  const upper = Math.min(nowMin, SESSION_CLOSE_MIN);
  if (upper < SESSION_OPEN_MIN + MINUTE_PAGE_STEP) {
    return [SESSION_OPEN_MIN + MINUTE_PAGE_STEP];
  }
  const marks: number[] = [];
  for (
    let m = upper;
    m >= SESSION_OPEN_MIN + MINUTE_PAGE_STEP;
    m -= MINUTE_PAGE_STEP
  ) {
    marks.push(m);
  }
  // 마지막 종료시각이 09:30이 아니면 09:30을 추가해 09:00~09:30 구간을 보장.
  if (marks.at(-1) !== SESSION_OPEN_MIN + MINUTE_PAGE_STEP) {
    marks.push(SESSION_OPEN_MIN + MINUTE_PAGE_STEP);
  }
  return marks;
}

async function fetchMinuteSeries(code: string): Promise<ChartSeries> {
  if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
    return EMPTY;
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < SESSION_OPEN_MIN) {
    return EMPTY;
  }
  try {
    const token = await getAccessToken();
    const marks = minuteEndMarks(nowMin);
    // 페이지들은 서로 독립적이라 병렬로 묶지만, KIS가 같은 토큰의 과도한 동시
    // 호출을 500으로 거부하는 경향이 있어 chunked + per-page retry로 안정화한다.
    const today = formatYYYYMMDD(now);
    const pages = await fetchMinutePages(code, marks, today, token);
    const seen = new Map<number, ChartPoint>();
    let prevClose = 0;
    for (const page of pages) {
      if (!page) {
        continue;
      }
      if (prevClose === 0 && page.prevClose > 0) {
        prevClose = page.prevClose;
      }
      for (const p of page.points) {
        seen.set(p.t, p);
      }
    }
    const points = [...seen.values()].sort((a, b) => a.t - b.t);
    return { points, prevClose };
  } catch (error) {
    log.warn({ kis: { event: "chart_minute", code, ok: false }, error });
    return EMPTY;
  }
}

async function fetchDailySeries(
  code: string,
  range: Exclude<ChartRange, "1D">
): Promise<ChartSeries> {
  if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
    return EMPTY;
  }
  const plan = DAILY_PLAN[range];
  try {
    const token = await getAccessToken();
    const now = new Date();
    const from = new Date(now.getTime() - plan.spanDays * 24 * 60 * 60_000);
    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: code,
      FID_INPUT_DATE_1: formatYYYYMMDD(from),
      FID_INPUT_DATE_2: formatYYYYMMDD(now),
      FID_PERIOD_DIV_CODE: plan.period,
      FID_ORG_ADJ_PRC: "0",
    });
    const res = await throttledKisCall(() =>
      fetch(`${REST_URL[env.KIS_ENV]}${DAILY_API}?${params}`, {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: env.KIS_APP_KEY,
          appsecret: env.KIS_APP_SECRET,
          tr_id: TR_DAILY,
          custtype: "P",
        },
      })
    );
    if (!res.ok) {
      log.warn({
        kis: {
          event: "chart_daily",
          code,
          range,
          status: res.status,
          ok: false,
        },
      });
      return EMPTY;
    }
    const body = (await res.json()) as {
      output1?: DailyOutput1;
      output2?: DailyRow[];
      rt_cd?: string;
    };
    if (body.rt_cd !== "0" || !body.output2) {
      return EMPTY;
    }
    const prevClose = Number(body.output1?.stck_prdy_clpr ?? 0);
    const points: ChartPoint[] = [];
    let idx = 0;
    for (let i = body.output2.length - 1; i >= 0; i -= 1) {
      const row = body.output2[i];
      const v = Number(row?.stck_clpr);
      const vol = Number(row?.acml_vol);
      if (Number.isNaN(v) || v <= 0) {
        continue;
      }
      points.push({ t: idx, v, vol: Number.isNaN(vol) ? 0 : vol });
      idx += 1;
    }
    return { points, prevClose: Number.isNaN(prevClose) ? 0 : prevClose };
  } catch (error) {
    log.warn({ kis: { event: "chart_daily", code, range, ok: false }, error });
    return EMPTY;
  }
}

/**
 * Fetches a price+volume series for the requested range, with a small TTL
 * cache to keep KIS REST traffic predictable. Returns oldest→newest values
 * plus prevClose (used as a baseline on 1D); empty series on any upstream
 * failure so the client can render a graceful empty state.
 */
export async function fetchStockChart(
  code: string,
  range: ChartRange
): Promise<ChartSeries> {
  const key = `${code}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlFor(range)) {
    return hit.series;
  }
  const series =
    range === "1D"
      ? await fetchMinuteSeries(code)
      : await fetchDailySeries(code, range);
  cache.set(key, { at: Date.now(), series });
  return series;
}

// 최근 N 거래일 종가만 number[]로 — Sparkline용 가벼운 응답. 1회 호출로 충분.
const SPARKLINE_TTL_MS = 60 * 60_000;
const SPARKLINE_SPAN_DAYS = 45;
const sparklineCache = new Map<string, { at: number; points: number[] }>();

/**
 * Fetches the recent close-price series for use as a sparkline (small inline
 * chart). Single KIS REST call for the last ~30 trading days, then cached for
 * an hour. Returns oldest→newest closes; empty on any upstream failure so the
 * caller can render a blank sparkline gracefully.
 */
export async function fetchStockSparkline(code: string): Promise<number[]> {
  const hit = sparklineCache.get(code);
  if (hit && Date.now() - hit.at < SPARKLINE_TTL_MS) {
    return hit.points;
  }
  if (!(env.KIS_APP_KEY && env.KIS_APP_SECRET)) {
    return [];
  }
  try {
    const token = await getAccessToken();
    const now = new Date();
    const from = new Date(
      now.getTime() - SPARKLINE_SPAN_DAYS * 24 * 60 * 60_000
    );
    const params = new URLSearchParams({
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: code,
      FID_INPUT_DATE_1: formatYYYYMMDD(from),
      FID_INPUT_DATE_2: formatYYYYMMDD(now),
      FID_PERIOD_DIV_CODE: "D",
      FID_ORG_ADJ_PRC: "0",
    });
    const res = await throttledKisCall(() =>
      fetch(`${REST_URL[env.KIS_ENV]}${DAILY_API}?${params}`, {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: env.KIS_APP_KEY,
          appsecret: env.KIS_APP_SECRET,
          tr_id: TR_DAILY,
          custtype: "P",
        },
      })
    );
    if (!res.ok) {
      log.warn({
        kis: { event: "sparkline", code, status: res.status, ok: false },
      });
      return [];
    }
    const body = (await res.json()) as {
      output2?: DailyRow[];
      rt_cd?: string;
    };
    if (body.rt_cd !== "0" || !body.output2) {
      return [];
    }
    const points: number[] = [];
    for (let i = body.output2.length - 1; i >= 0; i -= 1) {
      const v = Number(body.output2[i]?.stck_clpr);
      if (!Number.isNaN(v) && v > 0) {
        points.push(v);
      }
    }
    sparklineCache.set(code, { at: Date.now(), points });
    return points;
  } catch (error) {
    log.warn({ kis: { event: "sparkline", code, ok: false }, error });
    return [];
  }
}
