import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { type LiveQuote, useQuotesStore } from "@/stores/quotes-store";

export type { LiveQuote } from "@/stores/quotes-store";

/**
 * Registers interest in a single symbol with the global quotes store and
 * returns the latest tick. The store ref-counts registrations so multiple
 * screens watching the same symbol share one upstream subscription. Selecting
 * a single value keeps this component out of re-render storms when other
 * symbols tick.
 */
export function useLiveQuote(code: string): LiveQuote | undefined {
  useEffect(() => {
    if (!code) {
      return;
    }
    const { register, unregister } = useQuotesStore.getState();
    register([code]);
    return () => unregister([code]);
  }, [code]);

  return useQuotesStore((s) => (code ? s.quotes[code] : undefined));
}

/**
 * Multi-symbol variant: registers all `codes` for the lifetime of the caller
 * and returns the subset of the quotes map keyed by those codes. Uses
 * `useShallow` so callers don't re-render on ticks of unrelated symbols.
 *
 * Prefer `useLiveQuote(code)` per row when rendering a list — row-level
 * subscription is the minimum scope and avoids re-rendering the whole list
 * on every tick.
 */
export function useLiveQuotes(codes: string[]): Record<string, LiveQuote> {
  const codesKey = useMemo(() => codes.slice().sort().join(","), [codes]);

  useEffect(() => {
    if (!codesKey) {
      return;
    }
    const arr = codesKey.split(",");
    const { register, unregister } = useQuotesStore.getState();
    register(arr);
    return () => unregister(arr);
  }, [codesKey]);

  return useQuotesStore(
    useShallow((s) => {
      if (!codesKey) {
        return {};
      }
      const out: Record<string, LiveQuote> = {};
      for (const c of codesKey.split(",")) {
        const q = s.quotes[c];
        if (q) {
          out[c] = q;
        }
      }
      return out;
    })
  );
}
