export interface ImageDimensions {
  height: number;
  width: number;
}

function validDimensions(
  width: number,
  height: number
): ImageDimensions | null {
  const integers = Number.isInteger(width) && Number.isInteger(height);
  if (!integers || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

interface JpegMarker {
  marker: number;
  payloadOffset: number;
}

function nextJpegMarker(input: Buffer, start: number): JpegMarker | null {
  let offset = start;
  while (offset < input.length && input[offset] !== 0xff) {
    offset += 1;
  }
  while (offset < input.length && input[offset] === 0xff) {
    offset += 1;
  }
  const marker = input[offset];
  if (marker === undefined) {
    return null;
  }
  return { marker, payloadOffset: offset + 1 };
}

function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function jpegDimensions(input: Buffer): ImageDimensions | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 4 <= input.length) {
    const next = nextJpegMarker(input, offset);
    if (!next || next.marker === 0xd9 || next.marker === 0xda) {
      return null;
    }
    offset = next.payloadOffset;
    if (isStandaloneJpegMarker(next.marker)) {
      continue;
    }
    if (offset + 2 > input.length) {
      return null;
    }
    const segmentLength = input.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > input.length) {
      return null;
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(next.marker)) {
      if (segmentLength < 7) {
        return null;
      }
      return validDimensions(
        input.readUInt16BE(offset + 5),
        input.readUInt16BE(offset + 3)
      );
    }
    offset += segmentLength;
  }
  return null;
}

function readUint24LE(input: Buffer, offset: number): number {
  const low = input[offset] ?? 0;
  const middle = input[offset + 1] ?? 0;
  const high = input[offset + 2] ?? 0;
  return low + middle * 256 + high * 65_536;
}

function webpDimensions(input: Buffer): ImageDimensions | null {
  if (
    input.length < 30 ||
    input.toString("ascii", 0, 4) !== "RIFF" ||
    input.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  const kind = input.toString("ascii", 12, 16);
  if (kind === "VP8X") {
    return validDimensions(
      readUint24LE(input, 24) + 1,
      readUint24LE(input, 27) + 1
    );
  }
  if (
    kind === "VP8 " &&
    input[23] === 0x9d &&
    input[24] === 0x01 &&
    input[25] === 0x2a
  ) {
    return validDimensions(
      input.readUInt16LE(26) % 16_384,
      input.readUInt16LE(28) % 16_384
    );
  }
  if (kind === "VP8L" && input[20] === 0x2f) {
    const bits = input.readUInt32LE(21);
    return validDimensions(
      (bits % 16_384) + 1,
      (Math.floor(bits / 16_384) % 16_384) + 1
    );
  }
  return null;
}

export function readImageDimensions(
  input: Buffer,
  mime: string
): ImageDimensions | null {
  if (mime === "image/png" && input.length >= 24) {
    return validDimensions(input.readUInt32BE(16), input.readUInt32BE(20));
  }
  if (mime === "image/gif" && input.length >= 10) {
    return validDimensions(input.readUInt16LE(6), input.readUInt16LE(8));
  }
  if (mime === "image/jpeg") {
    return jpegDimensions(input);
  }
  if (mime === "image/webp") {
    return webpDimensions(input);
  }
  return null;
}

export function isWithinImageDimensionLimits(
  dimensions: ImageDimensions,
  maxEdge: number,
  maxPixels: number
): boolean {
  return (
    dimensions.width <= maxEdge &&
    dimensions.height <= maxEdge &&
    dimensions.width * dimensions.height <= maxPixels
  );
}
