import { stockMaster } from "@moneyroad-app/db/schema";
import AdmZip from "adm-zip";
import { getTableColumns, sql } from "drizzle-orm";
import { log } from "evlog";
import iconv from "iconv-lite";

import { getDb } from "../news/db";
import { parseMaster, type StockMasterRow } from "./parser";
import { MASTER_SOURCES, type MarketType } from "./spec";

const UPSERT_CHUNK = 500;

/** Downloads a master zip and returns the raw (CP949) .mst bytes. */
async function downloadMaster(market: MarketType): Promise<Buffer> {
  const { url, entry } = MASTER_SOURCES[market];
  const res = await globalThis.fetch(url);
  if (!res.ok) {
    throw new Error(`stock master download failed: ${res.status} (${url})`);
  }
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  const file = zip.getEntry(entry) ?? zip.getEntries()[0];
  if (!file) {
    throw new Error(`stock master zip is empty (${url})`);
  }
  return file.getData();
}

// Build the ON CONFLICT update set once: refresh every column from the proposed
// row except the primary key and created_at, and bump updated_at.
function buildUpdateSet() {
  const cols = getTableColumns(stockMaster);
  const set: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(cols)) {
    if (key === "mkscShrnIscd" || key === "createdAt" || key === "updatedAt") {
      continue;
    }
    set[key] = sql.raw(`excluded."${col.name}"`);
  }
  set.updatedAt = sql`now()`;
  return set;
}

async function upsertRows(rows: StockMasterRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  const db = getDb();
  const updateSet = buildUpdateSet();
  let count = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK);
    await db
      .insert(stockMaster)
      .values(chunk as (typeof stockMaster.$inferInsert)[])
      .onConflictDoUpdate({
        target: stockMaster.mkscShrnIscd,
        set: updateSet,
      });
    count += chunk.length;
  }
  return count;
}

async function loadMarket(market: MarketType): Promise<number> {
  const buf = await downloadMaster(market);
  const text = iconv.decode(buf, "cp949");
  const rows = parseMaster(text, market);
  const upserted = await upsertRows(rows);
  log.info({
    stockMaster: { event: "market_loaded", market, count: upserted },
  });
  return upserted;
}

/**
 * Downloads the KOSPI + KOSDAQ master files from KIS and upserts them into
 * stock_master. Upsert (not replace) preserves rows referenced by news /
 * watchlist FKs. Requires DATABASE_URL; needs no KIS credentials (public files).
 */
export async function loadStockMaster(): Promise<{
  kospi: number;
  kosdaq: number;
}> {
  const kospi = await loadMarket("KOSPI");
  const kosdaq = await loadMarket("KOSDAQ");
  log.info({
    stockMaster: { event: "loaded", kospi, kosdaq, total: kospi + kosdaq },
  });
  return { kospi, kosdaq };
}
