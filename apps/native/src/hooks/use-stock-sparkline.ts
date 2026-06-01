import { env } from "@moneyroad-app/env/native";
import { useQuery } from "@tanstack/react-query";

import { useLiveQuote } from "@/hooks/use-live-quotes";
import { authClient } from "@/lib/auth-client";
import { fetchStreamToken } from "@/lib/stream-token";

const SPARKLINE_STALE_MS = 60 * 60_000; // 1h — realtime 서버 캐시와 동일.

interface SparklineResponse {
  points?: number[];
}

async function fetchSparkline(code: string): Promise<number[]> {
  const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
  if (!(baseUrl && code)) {
    return [];
  }
  const token = await fetchStreamToken();
  if (!token) {
    return [];
  }
  try {
    const params = new URLSearchParams({ code, token });
    const res = await fetch(`${baseUrl}/quote/sparkline?${params}`);
    if (!res.ok) {
      return [];
    }
    const body = (await res.json()) as SparklineResponse;
    return body.points ?? [];
  } catch {
    return [];
  }
}

/**
 * Returns the recent close-price series for a sparkline, with the very last
 * point overridden by the live tick (so the inline chart's endpoint matches
 * whatever price the user sees beside it). Empty array while loading / on
 * failure / signed-out — caller renders a blank sparkline.
 */
export function useStockSparkline(code: string): number[] {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const { data } = useQuery({
    queryKey: ["stock-sparkline", code],
    queryFn: () => fetchSparkline(code),
    enabled: !!(userId && code),
    staleTime: SPARKLINE_STALE_MS,
    gcTime: SPARKLINE_STALE_MS,
  });

  const live = useLiveQuote(code);
  const series = data ?? [];
  if (series.length > 0 && live) {
    return [...series.slice(0, -1), live.price];
  }
  return series;
}
