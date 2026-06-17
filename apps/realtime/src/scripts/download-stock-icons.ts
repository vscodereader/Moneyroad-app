// CLI: read stock_master.mksc_shrn_iscd and download Toss securities icons.
//   pnpm --filter realtime download:stock-icons
// Requires DATABASE_URL. Files are saved to apps/native/assets/stock-icons by default.
import "dotenv/config";

import { resolve } from "node:path";
import { log } from "evlog";

import {
  DEFAULT_STOCK_ICON_OUTPUT_DIR,
  downloadStockIcons,
  readStockIconCodesFromDb,
} from "@/services/stock-icons";

interface CliOptions {
  concurrency?: number;
  limit?: number;
  outputDir?: string;
  overwrite: boolean;
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
      "Usage: pnpm --filter realtime download:stock-icons [options]",
      "",
      "Options:",
      `  --output-dir <path>   Save directory (default: ${DEFAULT_STOCK_ICON_OUTPUT_DIR})`,
      "  --overwrite           Re-download files that already exist",
      "  --limit <count>       Download only the first N stock codes",
      "  --concurrency <count> Number of concurrent downloads (default: 8)",
      "  --help                Show this help",
      "",
    ].join("\n")
  );
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = { overwrite: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }

    if (arg === "--output-dir") {
      options.outputDir = resolve(readOptionValue(args, index, arg));
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

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const allCodes = await readStockIconCodesFromDb();
  const codes =
    typeof options.limit === "number"
      ? allCodes.slice(0, options.limit)
      : allCodes;
  const { results, summary } = await downloadStockIcons(codes, {
    concurrency: options.concurrency,
    outputDir: options.outputDir,
    overwrite: options.overwrite,
  });
  const failed = results.filter((result) => result.status === "failed");

  log.info({
    stockIcons: {
      event: "download_done",
      outputDir: options.outputDir ?? DEFAULT_STOCK_ICON_OUTPUT_DIR,
      summary,
    },
  });

  if (failed.length > 0) {
    log.warn({
      stockIcons: {
        event: "download_failed_sample",
        failures: failed.slice(0, 20),
        total: failed.length,
      },
    });
  }

  if (summary.failed > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  log.error({ err, stockIcons: { event: "download_failed" } });
  process.exit(1);
});
