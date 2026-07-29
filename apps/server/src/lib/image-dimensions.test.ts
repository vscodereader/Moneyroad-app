import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWithinImageDimensionLimits,
  readImageDimensions,
} from "./image-dimensions";

describe("readImageDimensions", () => {
  it("reads PNG IHDR dimensions", () => {
    const input = Buffer.alloc(24);
    input.writeUInt32BE(1200, 16);
    input.writeUInt32BE(800, 20);
    assert.deepEqual(readImageDimensions(input, "image/png"), {
      width: 1200,
      height: 800,
    });
  });

  it("reads GIF logical screen dimensions", () => {
    const input = Buffer.alloc(10);
    input.writeUInt16LE(640, 6);
    input.writeUInt16LE(480, 8);
    assert.deepEqual(readImageDimensions(input, "image/gif"), {
      width: 640,
      height: 480,
    });
  });

  it("reads JPEG start-of-frame dimensions", () => {
    const input = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x07, 0x08, 0x00, 0x10, 0x00, 0x20,
    ]);
    assert.deepEqual(readImageDimensions(input, "image/jpeg"), {
      width: 32,
      height: 16,
    });
  });

  it("reads extended WebP canvas dimensions", () => {
    const input = Buffer.alloc(30);
    input.write("RIFF", 0, "ascii");
    input.write("WEBP", 8, "ascii");
    input.write("VP8X", 12, "ascii");
    const widthMinusOne = 1919;
    const heightMinusOne = 1079;
    input.writeUIntLE(widthMinusOne, 24, 3);
    input.writeUIntLE(heightMinusOne, 27, 3);
    assert.deepEqual(readImageDimensions(input, "image/webp"), {
      width: 1920,
      height: 1080,
    });
  });

  it("rejects unreadable headers", () => {
    assert.equal(readImageDimensions(Buffer.alloc(3), "image/jpeg"), null);
  });
});

describe("isWithinImageDimensionLimits", () => {
  it("accepts dimensions within both limits", () => {
    assert.equal(
      isWithinImageDimensionLimits(
        { width: 5000, height: 5000 },
        8192,
        25_000_000
      ),
      true
    );
  });

  it("rejects an oversized edge", () => {
    assert.equal(
      isWithinImageDimensionLimits(
        { width: 8193, height: 100 },
        8192,
        25_000_000
      ),
      false
    );
  });

  it("rejects an oversized pixel count", () => {
    assert.equal(
      isWithinImageDimensionLimits(
        { width: 6000, height: 5000 },
        8192,
        25_000_000
      ),
      false
    );
  });
});
