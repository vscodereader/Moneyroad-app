import { create } from "zustand";

export interface LiveQuote {
  change: number;
  changeRate: number;
  price: number;
  ts: number;
}

interface QuotesState {
  /** 현재 SSE manager가 구독해야 하는 종목 셋(정렬·dedup 후). 참조 동일성으로 비교. */
  activeSymbols: string[];
  applySeed: (seed: Record<string, LiveQuote>) => void;
  applyTick: (symbol: string, q: LiveQuote) => void;
  clear: () => void;
  /** symbol → latest tick (seed 또는 SSE). */
  quotes: Record<string, LiveQuote>;
  /** symbol → 활성 register 카운트. 0이 되면 activeSymbols에서 제거. */
  refCounts: Record<string, number>;
  register: (symbols: string[]) => void;
  unregister: (symbols: string[]) => void;
}

function nextActive(refCounts: Record<string, number>): string[] {
  return Object.keys(refCounts)
    .filter((k) => (refCounts[k] ?? 0) > 0)
    .sort();
}

function sameActive(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export const useQuotesStore = create<QuotesState>((set) => ({
  quotes: {},
  refCounts: {},
  activeSymbols: [],
  register: (symbols) =>
    set((state) => {
      const refCounts = { ...state.refCounts };
      for (const s of symbols) {
        refCounts[s] = (refCounts[s] ?? 0) + 1;
      }
      const active = nextActive(refCounts);
      return sameActive(active, state.activeSymbols)
        ? { refCounts }
        : { refCounts, activeSymbols: active };
    }),
  unregister: (symbols) =>
    set((state) => {
      const refCounts = { ...state.refCounts };
      for (const s of symbols) {
        const cur = refCounts[s] ?? 0;
        if (cur <= 1) {
          delete refCounts[s];
        } else {
          refCounts[s] = cur - 1;
        }
      }
      const active = nextActive(refCounts);
      return sameActive(active, state.activeSymbols)
        ? { refCounts }
        : { refCounts, activeSymbols: active };
    }),
  applySeed: (seed) =>
    set((state) => {
      // SSE 라이브 틱이 이미 있으면 보존(시드는 더 오래된 값). 새 키만 채움.
      const quotes = { ...state.quotes };
      let changed = false;
      for (const [sym, q] of Object.entries(seed)) {
        if (!quotes[sym]) {
          quotes[sym] = q;
          changed = true;
        }
      }
      return changed ? { quotes } : {};
    }),
  applyTick: (symbol, q) =>
    set((state) => ({ quotes: { ...state.quotes, [symbol]: q } })),
  clear: () => set({ quotes: {}, refCounts: {}, activeSymbols: [] }),
}));
