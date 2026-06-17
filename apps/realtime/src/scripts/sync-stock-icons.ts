// CLI: read stock_master.mksc_shrn_iscd, upload Toss icons to GCS, and upsert stock_resource.
//   STOCK_ICON_BUCKET=... pnpm --filter realtime sync:stock-icons
// Requires DATABASE_URL and STOCK_ICON_BUCKET.
import "dotenv/config";

import { log } from "evlog";

import {
  readStockIconCodesFromDb,
  syncStockIconResource,
  verifyStockIconStorageAccess,
} from "@/services/stock-icons";

const DEFAULT_CONCURRENCY = 8;

interface CliOptions {
  bucketName?: string;
  cacheControl?: string;
  cdnBaseUrl?: string;
  concurrency?: number;
  limit?: number;
}

interface SyncSummary {
  failed: number;
  missing: number;
  ready: number;
  total: number;
}

function parsePositiveInteger(name: string, value: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return numberValue;
}

function readOptionValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function printHelp(): void {
  process.stdout.write(
    [
      "Usage: STOCK_ICON_BUCKET=<bucket> pnpm --filter realtime sync:stock-icons [options]",
      "",
      "Options:",
      "  --bucket <name>       GCS bucket name (default: STOCK_ICON_BUCKET)",
      "  --cdn-base-url <url>  CDN base URL stored for logging (default: STOCK_ICON_CDN_BASE_URL)",
      "  --cache-control <v>   GCS Cache-Control metadata (default: long immutable cache)",
      "  --limit <count>       Sync only the first N stock codes",
      "  --concurrency <count> Number of concurrent sync jobs (default: 8)",
      "  --help                Show this help",
      "",
    ].join("\n")
  );
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    bucketName: process.env.STOCK_ICON_BUCKET,
    cacheControl: process.env.STOCK_ICON_CACHE_CONTROL,
    cdnBaseUrl: process.env.STOCK_ICON_CDN_BASE_URL,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--bucket") {
      options.bucketName = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--cdn-base-url") {
      options.cdnBaseUrl = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--cache-control") {
      options.cacheControl = readOptionValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      options.limit = parsePositiveInteger(
        arg,
        readOptionValue(args, index, arg)
      );
      index += 1;
      continue;
    }

    if (arg === "--concurrency") {
      options.concurrency = parsePositiveInteger(
        arg,
        readOptionValue(args, index, arg)
      );
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function createSummary(
  results: Awaited<ReturnType<typeof syncStockIconResource>>[]
): SyncSummary {
  const summary: SyncSummary = {
    failed: 0,
    missing: 0,
    ready: 0,
    total: results.length,
  };

  for (const result of results) {
    summary[result.status] += 1;
  }

  return summary;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function syncCodes(
  codes: string[],
  options: Required<Pick<CliOptions, "bucketName">> & CliOptions
): Promise<Awaited<ReturnType<typeof syncStockIconResource>>[]> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const results: Awaited<ReturnType<typeof syncStockIconResource>>[] = [];
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < codes.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const code = codes[currentIndex];
      if (code === undefined) {
        break;
      }
      results.push(
        await syncStockIconResource(code, {
          bucketName: options.bucketName,
          cacheControl: options.cacheControl,
          cdnBaseUrl: options.cdnBaseUrl,
        })
      );
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, codes.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results;
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  if (!options.bucketName) {
    throw new Error("STOCK_ICON_BUCKET or --bucket is required");
  }

  await verifyStockIconStorageAccess({
    bucketName: options.bucketName,
    cacheControl: options.cacheControl,
  });

  const allCodes = await readStockIconCodesFromDb();
  const codes =
    typeof options.limit === "number"
      ? allCodes.slice(0, options.limit)
      : allCodes;
  const results = await syncCodes(codes, {
    ...options,
    bucketName: options.bucketName,
  });
  const summary = createSummary(results);
  const failed = results.filter((result) => result.status === "failed");

  log.info({
    stockIcons: {
      bucketName: options.bucketName,
      cdnBaseUrl: options.cdnBaseUrl,
      event: "sync_done",
      summary,
    },
  });

  if (failed.length > 0) {
    log.warn({
      stockIcons: {
        event: "sync_failed_sample",
        failures: failed.slice(0, 20),
        total: failed.length,
      },
    });
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  log.error({
    err,
    stockIcons: { errorMessage: getErrorMessage(err), event: "sync_failed" },
  });
  process.exit(1);
});
