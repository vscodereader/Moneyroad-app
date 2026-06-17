import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import {
  buildStockIconPublicUrl,
  buildStockIconStorageKey,
  buildTossStockIconUrl,
  downloadStockIcon,
  normalizeStockIconCodes,
} from "./stock-icons";

const tempRoot = await mkdtemp(join(tmpdir(), "moneyroad-stock-icons-"));

after(async () => {
  await rm(tempRoot, { force: true, recursive: true });
});

test("buildTossStockIconUrl builds the Toss securities icon URL", () => {
  assert.equal(
    buildTossStockIconUrl("005930"),
    "https://static.toss.im/png-icons/securities/icn-sec-fill-005930.png"
  );
});

test("buildStockIconStorageKey builds stable CDN object keys", () => {
  assert.equal(buildStockIconStorageKey("005930"), "stock-icons/005930.png");
});

test("buildStockIconPublicUrl joins CDN base URL and storage key", () => {
  assert.equal(
    buildStockIconPublicUrl(
      "https://cdn.moneyroad.example/",
      "stock-icons/005930.png"
    ),
    "https://cdn.moneyroad.example/stock-icons/005930.png"
  );
});

test("normalizeStockIconCodes removes empty and duplicate codes in order", () => {
  assert.deepEqual(
    normalizeStockIconCodes(["005930", "", " 000660 ", "005930", "   "]),
    ["005930", "000660"]
  );
});

test("downloadStockIcon saves png bytes and skips existing files by default", async () => {
  const outputDir = join(tempRoot, "icons");
  await mkdir(outputDir, { recursive: true });

  let calls = 0;
  const fetchImpl: typeof fetch = () => {
    calls += 1;
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
        status: 200,
      })
    );
  };

  const first = await downloadStockIcon("005930", {
    fetchImpl,
    outputDir,
  });
  const second = await downloadStockIcon("005930", {
    fetchImpl,
    outputDir,
  });

  assert.equal(first.status, "saved");
  assert.equal(second.status, "skipped");
  assert.equal(calls, 1);
  assert.deepEqual(
    [...new Uint8Array(await readFile(first.filePath))],
    [1, 2, 3]
  );
});

test("downloadStockIcon treats Toss 403 as a missing icon", async () => {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(
      new Response("<Error>AccessDenied</Error>", {
        headers: { "content-type": "application/xml" },
        status: 403,
      })
    );

  const result = await downloadStockIcon("000087", {
    fetchImpl,
    outputDir: join(tempRoot, "missing-icons"),
  });

  assert.equal(result.status, "missing");
});
