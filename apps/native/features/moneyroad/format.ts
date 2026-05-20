// MoneyRoad — number/price formatting helpers

import type { MrTokens } from "./theme";

export const fmt = {
  num: (n: number) => n.toLocaleString("ko-KR"),
  price: (n: number) => n.toLocaleString("ko-KR"),
  pct: (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}%`,
  signedNum: (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("ko-KR")}`,
  indexValue: (n: number) =>
    n.toLocaleString("ko-KR", { minimumFractionDigits: 2 }),
};

// Resolve the Korean-convention color for a delta (up = red, down = blue).
export function changeColor(n: number, t: MrTokens): string {
  if (n > 0) {
    return t.upStrong;
  }
  if (n < 0) {
    return t.downStrong;
  }
  return t.neutral;
}
