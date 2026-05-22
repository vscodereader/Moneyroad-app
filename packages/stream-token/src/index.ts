import { createHmac, timingSafeEqual } from "node:crypto";

export interface StreamTokenPayload {
  /** Expiry as epoch seconds. */
  exp: number;
  /** Authenticated user id. */
  sub: string;
}

/**
 * Minimal HMAC-signed token (`<base64url payload>.<base64url signature>`) shared
 * between the API server (which mints after validating a session) and the
 * realtime service (which verifies the signature without any DB lookup).
 * No external deps so it bundles cleanly into both services.
 */
export function signStreamToken(
  payload: StreamTokenPayload,
  secret: string
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

export function verifyStreamToken(
  token: string,
  secret: string
): StreamTokenPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) {
    return null;
  }
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    signatureBuf.length !== expectedBuf.length ||
    !timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return null;
  }

  let payload: StreamTokenPayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as StreamTokenPayload;
  } catch {
    return null;
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp * 1000 < Date.now()
  ) {
    return null;
  }
  return payload;
}
