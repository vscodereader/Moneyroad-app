import { stockMaster } from "@moneyroad-app/db/schema";
import { log } from "evlog";

import { getDb } from "./db";

interface StockEntry {
  code: string;
  name: string;
}

const REFRESH_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const MIN_NAME_LEN = 2; // skip 1-char names to cut false positives

let index: StockEntry[] = [];
let loadedAt = 0;
let loading: Promise<void> | null = null;

/**
 * Loads (and caches) the stock_master name→code index, longest name first so
 * "삼성전자" wins over "삼성". Refreshed lazily every {@link REFRESH_TTL_MS}.
 */
function ensureIndex(): Promise<void> {
  if (index.length > 0 && Date.now() - loadedAt < REFRESH_TTL_MS) {
    return Promise.resolve();
  }
  if (loading) {
    return loading;
  }
  loading = (async () => {
    try {
      const rows = await getDb()
        .select({
          code: stockMaster.mkscShrnIscd,
          name: stockMaster.htsKorIsnm,
        })
        .from(stockMaster);
      index = rows
        .filter((r) => r.name && r.name.length >= MIN_NAME_LEN)
        .sort((a, b) => b.name.length - a.name.length);
      loadedAt = Date.now();
      log.info({ news: { event: "stock_index_loaded", count: index.length } });
    } catch (err) {
      log.error({ err, news: { event: "stock_index_load_failed" } });
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/**
 * Returns the stock code of the most specific (longest) stock name mentioned in
 * the text, or null. Matches the title primarily; pass content as a fallback.
 */
export async function matchStockCode(
  title: string,
  content?: string | null
): Promise<string | null> {
  await ensureIndex();
  if (index.length === 0) {
    return null;
  }

  for (const entry of index) {
    if (title.includes(entry.name)) {
      return entry.code;
    }
  }
  if (content) {
    for (const entry of index) {
      if (content.includes(entry.name)) {
        return entry.code;
      }
    }
  }
  return null;
}
