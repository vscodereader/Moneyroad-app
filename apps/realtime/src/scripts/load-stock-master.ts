// CLI: download the KIS KOSPI/KOSDAQ masters and upsert into stock_master.
//   pnpm --filter realtime load:stock-master
// Requires DATABASE_URL (no KIS credentials needed — the .mst files are public).
import { log } from "evlog";
import { loadStockMaster } from "@/services/stock-master/loader";

loadStockMaster()
  .then((result) => {
    log.info({ stockMaster: { event: "cli_done", ...result } });
    process.exit(0);
  })
  .catch((err) => {
    log.error({ err, stockMaster: { event: "cli_failed" } });
    process.exit(1);
  });
