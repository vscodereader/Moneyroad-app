import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Storage } from "@google-cloud/storage";
import { createDb } from "@moneyroad-app/db/client";
import { stockMaster, stockResource } from "@moneyroad-app/db/schema";

const TOSS_STOCK_ICON_BASE_URL = "https://static.toss.im/png-icons/securities";
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_STOCK_ICON_CACHE_CONTROL = "public, max-age=31536000, immutable";
const STOCK_ICON_MIME_TYPE = "image/png";
const STOCK_ICON_RESOURCE_TYPE = "icon";
const STOCK_ICON_PROVIDER = "toss";
const LEADING_SLASHES = /^\/+/;
const TRAILING_SLASHES = /\/+$/;
const TOSS_MISSING_ICON_STATUSES = new Set([403, 404]);

let stockIconDb: ReturnType<typeof createDb> | null = null;
let stockIconDbUrl: string | null = null;

export const DEFAULT_STOCK_ICON_OUTPUT_DIR = fileURLToPath(
  new URL("../../../native/assets/stock-icons/", import.meta.url)
);

export type StockIconDownloadStatus =
  | "failed"
  | "missing"
  | "saved"
  | "skipped";

export interface StockIconDownloadResult {
  code: string;
  error?: string;
  filePath: string;
  status: StockIconDownloadStatus;
}

export interface StockIconDownloadOptions {
  fetchImpl?: typeof fetch;
  outputDir?: string;
  overwrite?: boolean;
}

export interface StockIconBatchOptions extends StockIconDownloadOptions {
  concurrency?: number;
}

export interface StockIconDownloadSummary {
  failed: number;
  missing: number;
  saved: number;
  skipped: number;
  total: number;
}

export interface StockIconUploadOptions {
  bucketName: string;
  cacheControl?: string;
  storage?: Storage;
}

export interface StockIconUploadResult {
  bucketName: string;
  etag?: string;
  storageKey: string;
}

export interface StockIconSyncOptions extends StockIconUploadOptions {
  cdnBaseUrl?: string;
  databaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface StockIconSyncResult {
  byteSize?: number;
  code: string;
  contentHash?: string;
  error?: string;
  etag?: string;
  publicUrl?: string;
  sourceUrl: string;
  status: "failed" | "missing" | "ready";
  storageBucket?: string;
  storageKey: string;
}

export function buildTossStockIconUrl(code: string): string {
  return `${TOSS_STOCK_ICON_BASE_URL}/icn-sec-fill-${encodeURIComponent(code)}.png`;
}

export function buildStockIconStorageKey(code: string): string {
  return `stock-icons/${code}.png`;
}

export function buildStockIconPublicUrl(
  cdnBaseUrl: string,
  storageKey: string
): string {
  return `${cdnBaseUrl.replace(TRAILING_SLASHES, "")}/${storageKey.replace(
    LEADING_SLASHES,
    ""
  )}`;
}

export function normalizeStockIconCodes(codes: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawCode of codes) {
    const code = rawCode.trim();
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    normalized.push(code);
  }

  return normalized;
}

function getStockIconDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for stock icon resources");
  }

  if (!stockIconDb || stockIconDbUrl !== databaseUrl) {
    stockIconDb = createDb(databaseUrl);
    stockIconDbUrl = databaseUrl;
  }

  return stockIconDb;
}

export async function readStockIconCodesFromDb(
  databaseUrl = process.env.DATABASE_URL
): Promise<string[]> {
  const rows = await getStockIconDb(databaseUrl)
    .select({ code: stockMaster.mkscShrnIscd })
    .from(stockMaster)
    .orderBy(stockMaster.mkscShrnIscd);

  return normalizeStockIconCodes(rows.map(({ code }) => code));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function getStockIconFilePath(outputDir: string, code: string): string {
  return `${outputDir}/${code}.png`;
}

export async function downloadStockIcon(
  code: string,
  options: StockIconDownloadOptions = {}
): Promise<StockIconDownloadResult> {
  const outputDir = options.outputDir ?? DEFAULT_STOCK_ICON_OUTPUT_DIR;
  const filePath = getStockIconFilePath(outputDir, code);

  await mkdir(outputDir, { recursive: true });

  if (!options.overwrite && (await fileExists(filePath))) {
    return { code, filePath, status: "skipped" };
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl(buildTossStockIconUrl(code));

  if (TOSS_MISSING_ICON_STATUSES.has(response.status)) {
    return { code, filePath, status: "missing" };
  }

  if (!response.ok) {
    return {
      code,
      error: `HTTP ${response.status}`,
      filePath,
      status: "failed",
    };
  }

  const contentType = response.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().includes("image/png")) {
    return {
      code,
      error: `unexpected content-type: ${contentType}`,
      filePath,
      status: "failed",
    };
  }

  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));

  return { code, filePath, status: "saved" };
}

async function fetchStockIconBytes(
  code: string,
  fetchImpl = globalThis.fetch
): Promise<
  | { buffer: Buffer; sourceUrl: string; status: "ready" }
  | { error?: string; sourceUrl: string; status: "failed" | "missing" }
> {
  const sourceUrl = buildTossStockIconUrl(code);
  const response = await fetchImpl(sourceUrl);

  if (TOSS_MISSING_ICON_STATUSES.has(response.status)) {
    return { sourceUrl, status: "missing" };
  }

  if (!response.ok) {
    return { error: `HTTP ${response.status}`, sourceUrl, status: "failed" };
  }

  const contentType = response.headers.get("content-type");
  if (
    contentType &&
    !contentType.toLowerCase().includes(STOCK_ICON_MIME_TYPE)
  ) {
    return {
      error: `unexpected content-type: ${contentType}`,
      sourceUrl,
      status: "failed",
    };
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    sourceUrl,
    status: "ready",
  };
}

export async function uploadStockIconToGcs(
  code: string,
  buffer: Buffer,
  options: StockIconUploadOptions
): Promise<StockIconUploadResult> {
  const storage = options.storage ?? new Storage();
  const storageKey = buildStockIconStorageKey(code);
  const file = storage.bucket(options.bucketName).file(storageKey);

  await file.save(buffer, {
    metadata: {
      cacheControl: options.cacheControl ?? DEFAULT_STOCK_ICON_CACHE_CONTROL,
      contentType: STOCK_ICON_MIME_TYPE,
    },
    resumable: false,
  });

  const [metadata] = await file.getMetadata();

  return {
    bucketName: options.bucketName,
    etag: metadata.etag,
    storageKey,
  };
}

export async function verifyStockIconStorageAccess(
  options: StockIconUploadOptions
): Promise<void> {
  const storage = options.storage ?? new Storage();

  try {
    await storage.bucket(options.bucketName).getMetadata();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        `Cannot access GCS bucket "${options.bucketName}".`,
        message,
        "For local runs, configure Application Default Credentials with `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS`.",
      ].join(" ")
    );
  }
}

async function upsertStockIconResource(
  result: StockIconSyncResult,
  databaseUrl = process.env.DATABASE_URL
): Promise<void> {
  await getStockIconDb(databaseUrl)
    .insert(stockResource)
    .values({
      byteSize: result.byteSize,
      contentHash: result.contentHash,
      errorMessage: result.error,
      mimeType: STOCK_ICON_MIME_TYPE,
      provider: STOCK_ICON_PROVIDER,
      sourceUrl: result.sourceUrl,
      status: result.status,
      stockCode: result.code,
      storageBucket: result.storageBucket,
      storageKey: result.storageKey,
      resourceType: STOCK_ICON_RESOURCE_TYPE,
    })
    .onConflictDoUpdate({
      target: [stockResource.stockCode, stockResource.resourceType],
      set: {
        byteSize: result.byteSize,
        contentHash: result.contentHash,
        etag: result.etag,
        errorMessage: result.error,
        lastSyncedAt: new Date(),
        mimeType: STOCK_ICON_MIME_TYPE,
        provider: STOCK_ICON_PROVIDER,
        sourceUrl: result.sourceUrl,
        status: result.status,
        storageBucket: result.storageBucket,
        storageKey: result.storageKey,
        updatedAt: new Date(),
      },
    });
}

export async function syncStockIconResource(
  code: string,
  options: StockIconSyncOptions
): Promise<StockIconSyncResult> {
  let fetched: Awaited<ReturnType<typeof fetchStockIconBytes>>;
  try {
    fetched = await fetchStockIconBytes(code, options.fetchImpl);
  } catch (error) {
    const result: StockIconSyncResult = {
      code,
      error: error instanceof Error ? error.message : String(error),
      sourceUrl: buildTossStockIconUrl(code),
      status: "failed",
      storageKey: buildStockIconStorageKey(code),
    };
    await upsertStockIconResource(result, options.databaseUrl);
    return result;
  }

  const baseResult = {
    code,
    sourceUrl: fetched.sourceUrl,
    storageKey: buildStockIconStorageKey(code),
  };

  if (fetched.status !== "ready") {
    const result: StockIconSyncResult = {
      ...baseResult,
      error: fetched.error,
      status: fetched.status,
    };
    await upsertStockIconResource(result, options.databaseUrl);
    return result;
  }

  let uploaded: StockIconUploadResult;
  try {
    uploaded = await uploadStockIconToGcs(code, fetched.buffer, options);
  } catch (error) {
    const result: StockIconSyncResult = {
      ...baseResult,
      byteSize: fetched.buffer.byteLength,
      contentHash: createHash("sha256").update(fetched.buffer).digest("hex"),
      error: error instanceof Error ? error.message : String(error),
      status: "failed",
    };
    await upsertStockIconResource(result, options.databaseUrl);
    return result;
  }

  const contentHash = createHash("sha256").update(fetched.buffer).digest("hex");
  const result: StockIconSyncResult = {
    ...baseResult,
    byteSize: fetched.buffer.byteLength,
    contentHash,
    etag: uploaded.etag,
    publicUrl: options.cdnBaseUrl
      ? buildStockIconPublicUrl(options.cdnBaseUrl, uploaded.storageKey)
      : undefined,
    status: "ready",
    storageBucket: uploaded.bucketName,
    storageKey: uploaded.storageKey,
  };

  await upsertStockIconResource(result, options.databaseUrl);
  return result;
}

function createSummary(
  results: StockIconDownloadResult[]
): StockIconDownloadSummary {
  const summary: StockIconDownloadSummary = {
    failed: 0,
    missing: 0,
    saved: 0,
    skipped: 0,
    total: results.length,
  };

  for (const result of results) {
    summary[result.status] += 1;
  }

  return summary;
}

export async function downloadStockIcons(
  codes: string[],
  options: StockIconBatchOptions = {}
): Promise<{
  results: StockIconDownloadResult[];
  summary: StockIconDownloadSummary;
}> {
  const normalizedCodes = normalizeStockIconCodes(codes);
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const results: StockIconDownloadResult[] = [];
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < normalizedCodes.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const code = normalizedCodes[currentIndex];
      if (code === undefined) {
        break;
      }
      try {
        results.push(await downloadStockIcon(code, options));
      } catch (error) {
        results.push({
          code,
          error: error instanceof Error ? error.message : String(error),
          filePath: getStockIconFilePath(
            options.outputDir ?? DEFAULT_STOCK_ICON_OUTPUT_DIR,
            code
          ),
          status: "failed",
        });
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, normalizedCodes.length) },
    () => worker()
  );
  await Promise.all(workers);

  results.sort(
    (left, right) =>
      normalizedCodes.indexOf(left.code) - normalizedCodes.indexOf(right.code)
  );

  return {
    results,
    summary: createSummary(results),
  };
}
