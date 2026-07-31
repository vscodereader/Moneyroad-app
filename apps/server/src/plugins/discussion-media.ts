import { randomUUID } from "node:crypto";
import fastifyMultipart from "@fastify/multipart";
import { Storage } from "@google-cloud/storage";
import { auth } from "@moneyroad-app/auth";
import { db } from "@moneyroad-app/db";
import {
  discussionFileAttachment,
  discussionMessage,
  discussionMessageImage,
  discussionRoom,
  discussionRoomBlock,
  moneyroadImage,
} from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/server";
import { fromNodeHeaders } from "better-auth/node";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { Jimp, JimpMime } from "jimp";

import {
  isWithinImageDimensionLimits,
  readImageDimensions,
} from "../lib/image-dimensions";

const MB = 1024 * 1024;
const IMAGE_MAX_BYTES = 10 * MB;
const IMAGE_MAX_EDGE = 8192;
const IMAGE_MAX_PIXELS = 25_000_000;
const FILE_MAX_BYTES = 20 * MB;
// Object keys: discussion/images/{uuid}, discussion/files/{uuid}/{safeName}.
// Objects uploaded before the CONTEXT.md 용어 정정 still sit under the previous
// prefix pair (docs/rfcs/0005 §11). Reads resolve the key stored on the DB row,
// never this constant, so both prefixes coexist and no object may be moved or
// deleted in the bucket.
const IMAGE_KEY_PREFIX = "discussion/images";
const FILE_KEY_PREFIX = "discussion/files";
// Private bucket → viewers reach bytes only through the access-checked proxy.
const MEDIA_CACHE_CONTROL = "private, max-age=3600";

// Real image types accepted for upload (verified by magic bytes, not filename).
const IMAGE_MIME_ALLOW = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// File-attachment allowlist by extension (the primary gate — plain text and
// several office/hwp formats have no reliable magic bytes).
const FILE_EXT_ALLOW = new Set([
  "pdf",
  "txt",
  "md",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "hwp",
  "hwpx",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
]);

// When magic-byte detection *does* resolve a concrete type, it must fall in
// this set — this rejects a disguised executable renamed to an allowed ext.
// Undetected (undefined) bytes stay allowed: text/office/hwp variants that
// file-type can't pin down still pass the extension gate above.
const FILE_DETECTED_MIME_ALLOW = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/zip",
  "application/x-cfb",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/x-hwp",
  "application/haansofthwp",
  "application/hwp+zip",
]);

let sharedStorage: Storage | null = null;
function getStorage(): Storage {
  if (!sharedStorage) {
    // ADC (local `gcloud auth application-default login`) or Cloud Run SA —
    // same auth model as the realtime thumbnail sync.
    sharedStorage = new Storage();
  }
  return sharedStorage;
}

// Session gate shared by every route. Returns the user id or null after having
// already sent a 401. Callers must `return` when it yields null.
async function requireUserId(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) {
    reply.status(401).send({ error: "Unauthorized", code: "NO_SESSION" });
    return null;
  }
  return session.user.id;
}

// Resolve the configured bucket or send a 503 (attachments stay off until a
// bucket is configured — mirrors the optional env).
function requireBucket(reply: FastifyReply): string | null {
  const bucket = env.DISCUSSION_ATTACHMENT_BUCKET;
  if (!bucket) {
    reply
      .status(503)
      .send({ error: "Attachments disabled", code: "NO_BUCKET" });
    return null;
  }
  return bucket;
}

// A room is readable when it exists and the requester is not actively blocked
// from it. Message reads require authentication, and an active room block
// prevents the signed-in user from fetching attachment bytes.
async function canAccessRoom(userId: string, roomId: number): Promise<boolean> {
  const [room] = await db
    .select({ id: discussionRoom.id })
    .from(discussionRoom)
    .where(eq(discussionRoom.id, roomId))
    .limit(1);
  if (!room) {
    return false;
  }
  const [blocked] = await db
    .select({ userId: discussionRoomBlock.userId })
    .from(discussionRoomBlock)
    .where(
      and(
        eq(discussionRoomBlock.userId, userId),
        eq(discussionRoomBlock.roomId, roomId),
        sql`${discussionRoomBlock.blockedUntil} > now()`
      )
    )
    .limit(1);
  return !blocked;
}

// Pick a Jimp-encodable output mime for the re-encoded image. Jimp v1 has no
// webp encoder, so webp is normalized to png (lossless); everything else keeps
// its type. Re-encoding strips EXIF (GPS/orientation) regardless.
function outputMimeFor(
  detected: string
): (typeof JimpMime)[keyof typeof JimpMime] {
  switch (detected) {
    case "image/png":
      return JimpMime.png;
    case "image/gif":
      return JimpMime.gif;
    case "image/jpeg":
      return JimpMime.jpeg;
    default:
      // webp (and any other decodable-but-not-encodable) → png.
      return JimpMime.png;
  }
}

function validateImageDimensions(
  input: Buffer,
  mime: string,
  reply: FastifyReply
): boolean {
  const dimensions = readImageDimensions(input, mime);
  if (!dimensions) {
    reply.status(415).send({ error: "Unreadable image", code: "BAD_IMAGE" });
    return false;
  }
  if (
    !isWithinImageDimensionLimits(dimensions, IMAGE_MAX_EDGE, IMAGE_MAX_PIXELS)
  ) {
    reply.status(413).send({
      error: "Image dimensions too large",
      code: "IMAGE_DIMENSIONS_TOO_LARGE",
    });
    return false;
  }
  return true;
}

const PATH_SEP_RE = /[/\\]/;
const UNSAFE_CHARS_RE = /[^\w.-]+/g;
const LEADING_DOTS_RE = /^\.+/;

// Basename + strip anything but a safe charset so the key can't traverse paths.
function safeFileName(name: string): string {
  const base = name.split(PATH_SEP_RE).pop() ?? "file";
  const cleaned = base
    .replace(UNSAFE_CHARS_RE, "_")
    .replace(LEADING_DOTS_RE, "");
  return cleaned.length > 0 ? cleaned.slice(0, 200) : "file";
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return "";
  }
  return name.slice(dot + 1).toLowerCase();
}

// Stream private-bucket bytes to the reply with the given content metadata.
// Returns the reply so the async route handler can `return` it: resolving an
// async handler with `undefined` makes Fastify call `reply.send(undefined)` a
// second time, which overwrites Content-Length with "0" and ships an empty
// body (fastify/lib/wrap-thenable.js → reply.js `onSendEnd`).
function streamObject(
  reply: FastifyReply,
  bucket: string,
  key: string,
  opts: { mime: string; size: number; downloadName?: string }
): FastifyReply {
  reply.header("Content-Type", opts.mime);
  reply.header("Content-Length", String(opts.size));
  reply.header("Cache-Control", MEDIA_CACHE_CONTROL);
  if (opts.downloadName) {
    reply.header(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`
    );
  }
  const stream = getStorage().bucket(bucket).file(key).createReadStream();
  stream.on("error", (err) => {
    reply.request.log.error({ err }, "discussion media stream failed");
    // Only safe to swap in an error payload while nothing has been written —
    // once the stream started piping the status line is already on the wire.
    if (!reply.raw.headersSent) {
      reply.status(404).send({ error: "Not found", code: "OBJECT_MISSING" });
    }
  });
  return reply.send(stream);
}

/* ----(업로드 전건 500 수정 — evlog 로거에 없는 레벨 보강, RFC 0005 §5-1)---- */
// Levels @fastify/multipart calls on `request.log` that evlog's logger lacks.
// evlog replaces `request.log` on every request (evlog/fastify `attachLogger`)
// with a logger exposing only info/warn/error — but multipart opens
// `request.file()` with `this.log.debug(...)` and also uses trace, so the very
// first upload byte throws "this.log.debug is not a function" (→ 500).
// Filling the gaps in this plugin's context keeps the shim next to the code
// that needs it instead of altering the shared logger for every route.
const MISSING_LOG_LEVELS = ["trace", "debug", "fatal"] as const;
/* ----(~업로드 전건 500 수정 상수 여기까지)---- */

export function registerDiscussionMediaPlugin(app: FastifyInstance) {
  /* ----(업로드 전건 500 수정 — 이 플러그인 컨텍스트 한정 로거 훅, RFC 0005 §5-1)---- */
  app.addHook("onRequest", (request, _reply, done) => {
    const log = request.log as unknown as Record<string, unknown>;
    for (const level of MISSING_LOG_LEVELS) {
      if (typeof log[level] !== "function") {
        // Diagnostic-only levels: dropping them loses nothing evlog reports.
        log[level] = () => {
          // noop
        };
      }
    }
    done();
  });
  /* ----(~업로드 전건 500 수정 로거 훅 여기까지)---- */

  // Scoped to this encapsulated context so the multipart content-type parser
  // doesn't leak into the oRPC / auth plugins.
  app.register(fastifyMultipart, {
    limits: { fileSize: FILE_MAX_BYTES, files: 1 },
    throwFileSizeLimit: true,
  });

  // POST /upload/discussion-image — one image, magic-byte verified,
  // EXIF-stripped, stored in the private bucket. -> { imageId }
  app.post("/upload/discussion-image", async (request, reply) => {
    const userId = await requireUserId(request, reply);
    if (!userId) {
      return;
    }
    const bucket = requireBucket(reply);
    if (!bucket) {
      return;
    }

    const part = await request.file({ limits: { fileSize: IMAGE_MAX_BYTES } });
    if (!part) {
      return reply.status(400).send({ error: "No file", code: "NO_FILE" });
    }

    let input: Buffer;
    try {
      input = await part.toBuffer();
    } catch {
      return reply
        .status(413)
        .send({ error: "Image too large", code: "IMAGE_TOO_LARGE" });
    }
    if (part.file.truncated || input.length > IMAGE_MAX_BYTES) {
      return reply
        .status(413)
        .send({ error: "Image too large", code: "IMAGE_TOO_LARGE" });
    }

    const detected = await fileTypeFromBuffer(input);
    if (!(detected && IMAGE_MIME_ALLOW.has(detected.mime))) {
      return reply
        .status(415)
        .send({ error: "Unsupported image type", code: "BAD_IMAGE_TYPE" });
    }

    // Read dimensions from the format header before Jimp allocates the decoded
    // bitmap. The compressed upload may be under 10MB while expanding to
    // hundreds of megabytes in memory.
    if (!validateImageDimensions(input, detected.mime, reply)) {
      return;
    }

    const outMime = outputMimeFor(detected.mime);
    let output: Buffer;
    let width: number;
    let height: number;
    try {
      const image = await Jimp.read(input);
      width = image.bitmap.width;
      height = image.bitmap.height;
      output = await image.getBuffer(outMime);
    } catch (err) {
      request.log.warn({ err }, "discussion image re-encode failed");
      return reply
        .status(415)
        .send({ error: "Unreadable image", code: "BAD_IMAGE" });
    }

    const key = `${IMAGE_KEY_PREFIX}/${randomUUID()}`;
    await getStorage()
      .bucket(bucket)
      .file(key)
      .save(output, {
        metadata: { contentType: outMime },
        resumable: false,
      });

    const [row] = await db
      .insert(moneyroadImage)
      .values({
        bucket,
        objectKey: key,
        mime: outMime,
        byteSize: output.length,
        originalByteSize: input.length,
        width,
        height,
        uploaderId: userId,
      })
      .returning({ id: moneyroadImage.id });
    if (!row) {
      throw new Error("이미지 저장 실패");
    }
    return reply.send({ imageId: row.id });
  });

  // POST /upload/discussion-file — one file (allowlisted), stored in the
  // private bucket verbatim. -> { fileAttachmentId }
  app.post("/upload/discussion-file", async (request, reply) => {
    const userId = await requireUserId(request, reply);
    if (!userId) {
      return;
    }
    const bucket = requireBucket(reply);
    if (!bucket) {
      return;
    }

    const part = await request.file({ limits: { fileSize: FILE_MAX_BYTES } });
    if (!part) {
      return reply.status(400).send({ error: "No file", code: "NO_FILE" });
    }

    const originalName = part.filename ?? "file";
    const ext = extensionOf(originalName);
    if (!FILE_EXT_ALLOW.has(ext)) {
      return reply
        .status(415)
        .send({ error: "Unsupported file type", code: "BAD_FILE_TYPE" });
    }

    let input: Buffer;
    try {
      input = await part.toBuffer();
    } catch {
      return reply
        .status(413)
        .send({ error: "File too large", code: "FILE_TOO_LARGE" });
    }
    if (part.file.truncated || input.length > FILE_MAX_BYTES) {
      return reply
        .status(413)
        .send({ error: "File too large", code: "FILE_TOO_LARGE" });
    }

    const detected = await fileTypeFromBuffer(input);
    if (detected && !FILE_DETECTED_MIME_ALLOW.has(detected.mime)) {
      return reply
        .status(415)
        .send({ error: "Unsupported file type", code: "BAD_FILE_TYPE" });
    }

    const safeName = safeFileName(originalName);
    const key = `${FILE_KEY_PREFIX}/${randomUUID()}/${safeName}`;
    // Trust the detected mime when known; fall back to the declared one.
    const mime = detected?.mime ?? part.mimetype ?? "application/octet-stream";
    await getStorage()
      .bucket(bucket)
      .file(key)
      .save(input, {
        metadata: { contentType: mime },
        resumable: false,
      });

    const [attachment] = await db
      .insert(discussionFileAttachment)
      .values({
        bucket,
        objectKey: key,
        mime,
        byteSize: input.length,
        fileName: originalName,
        uploaderId: userId,
      })
      .returning({ id: discussionFileAttachment.id });
    if (!attachment) {
      throw new Error("파일 첨부 정보 저장 실패");
    }
    return reply.send({ fileAttachmentId: attachment.id });
  });

  // GET /media/discussion-image/:imageId — proxy an image's bytes after
  // verifying the requester can reach a non-deleted, non-blinded message that
  // links it (or is the uploader, for a not-yet-sent preview).
  app.get<{ Params: { imageId: string } }>(
    "/media/discussion-image/:imageId",
    async (request, reply) => {
      const userId = await requireUserId(request, reply);
      if (!userId) {
        return;
      }
      const imageId = Number(request.params.imageId);
      if (!Number.isInteger(imageId)) {
        return reply.status(400).send({ error: "Bad id", code: "BAD_ID" });
      }

      const [image] = await db
        .select({
          bucket: moneyroadImage.bucket,
          objectKey: moneyroadImage.objectKey,
          mime: moneyroadImage.mime,
          byteSize: moneyroadImage.byteSize,
          uploaderId: moneyroadImage.uploaderId,
        })
        .from(moneyroadImage)
        .where(eq(moneyroadImage.id, imageId))
        .limit(1);
      if (!image) {
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });
      }

      // Messages that link this image and are still visible (not deleted/blinded).
      const links = await db
        .select({ roomId: discussionMessage.roomId })
        .from(discussionMessageImage)
        .innerJoin(
          discussionMessage,
          eq(discussionMessageImage.messageId, discussionMessage.id)
        )
        .where(
          and(
            eq(discussionMessageImage.imageId, imageId),
            isNull(discussionMessage.deletedAt),
            isNull(discussionMessage.blindedAt)
          )
        );

      let allowed = false;
      for (const link of links) {
        if (await canAccessRoom(userId, link.roomId)) {
          allowed = true;
          break;
        }
      }
      // Uploader may preview their own image before/without sending it.
      if (!allowed && image.uploaderId === userId) {
        allowed = true;
      }
      if (!allowed) {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      return streamObject(reply, image.bucket, image.objectKey, {
        mime: image.mime,
        size: image.byteSize,
      });
    }
  );

  // GET /media/discussion-file/:messageId — proxy a file message's bytes after
  // verifying room access. Deleted/blinded attachments are refused.
  app.get<{ Params: { messageId: string } }>(
    "/media/discussion-file/:messageId",
    async (request, reply) => {
      const userId = await requireUserId(request, reply);
      if (!userId) {
        return;
      }
      const messageId = Number(request.params.messageId);
      if (!Number.isInteger(messageId)) {
        return reply.status(400).send({ error: "Bad id", code: "BAD_ID" });
      }

      const [message] = await db
        .select({
          roomId: discussionMessage.roomId,
          type: discussionMessage.type,
          fileBucket: discussionMessage.fileBucket,
          fileKey: discussionMessage.fileKey,
          fileMime: discussionMessage.fileMime,
          fileSize: discussionMessage.fileSize,
          fileName: discussionMessage.fileName,
          deletedAt: discussionMessage.deletedAt,
          blindedAt: discussionMessage.blindedAt,
        })
        .from(discussionMessage)
        .where(eq(discussionMessage.id, messageId))
        .limit(1);
      if (
        !message ||
        message.type !== "file" ||
        !(message.fileBucket && message.fileKey)
      ) {
        return reply
          .status(404)
          .send({ error: "Not found", code: "NOT_FOUND" });
      }
      if (message.deletedAt || message.blindedAt) {
        return reply.status(403).send({ error: "Gone", code: "MASKED" });
      }
      if (!(await canAccessRoom(userId, message.roomId))) {
        return reply
          .status(403)
          .send({ error: "Forbidden", code: "FORBIDDEN" });
      }

      return streamObject(reply, message.fileBucket, message.fileKey, {
        mime: message.fileMime ?? "application/octet-stream",
        size: message.fileSize ?? 0,
        downloadName: message.fileName ?? undefined,
      });
    }
  );
}
