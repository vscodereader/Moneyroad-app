import { env } from "@moneyroad-app/env/native";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { fetchStreamToken } from "@/lib/stream-token";

export const STOCK_CHART_RANGES = ["1D", "3M", "1Y", "3Y"] as const;
export type StockChartRange = (typeof STOCK_CHART_RANGES)[number];

export const STOCK_CHART_RANGE_LABELS: Record<StockChartRange, string> = {
  "1D": "1일",
  "3M": "3개월",
  "1Y": "1년",
  "3Y": "3년",
};

// 정규장 09:00~15:30 — 1D 차트 X축 상한.
export const SESSION_MINUTES = 6 * 60 + 30;

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

const EMPTY: ChartSeries = { points: [], prevClose: 0 };

async function fetchChartSeries(
  baseUrl: string,
  code: string,
  range: StockChartRange
): Promise<ChartSeries> {
  const token = await fetchStreamToken();
  if (!token) {
    return EMPTY;
  }
  try {
    const params = new URLSearchParams({ code, range, token });
    const res = await fetch(`${baseUrl}/chart/stock?${params}`);
    if (!res.ok) {
      return EMPTY;
    }
    const body = (await res.json()) as ChartSeries;
    return {
      points: Array.isArray(body.points) ? body.points : [],
      prevClose: typeof body.prevClose === "number" ? body.prevClose : 0,
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Fetches a chart series (price+volume + prevClose baseline) for the given
 * (code, range) from realtime's `/chart/stock` proxy. Returns the EMPTY
 * series while loading or on failure so callers can render a placeholder
 * without a separate error path. Stock charts are private — the hook
 * short-circuits when no user is signed in.
 */
export function useStockChart(
  code: string,
  range: StockChartRange
): ChartSeries {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [series, setSeries] = useState<ChartSeries>(EMPTY);

  useEffect(() => {
    const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
    // 새 (code, range) 진입 시 이전 시리즈가 잠깐 잘못 보이는 걸 막기 위해 비우고 시작.
    setSeries(EMPTY);
    if (!(baseUrl && userId && code)) {
      return;
    }
    let cancelled = false;
    fetchChartSeries(baseUrl, code, range).then((next) => {
      if (!cancelled) {
        setSeries(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId, code, range]);

  return series;
}
