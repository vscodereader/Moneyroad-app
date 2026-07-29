import { randomUUID } from "node:crypto";
import fastifyMultipart from "@fastify/multipart";
import { Storage } from "@google-cloud/storage";
import { auth } from "@moneyroad-app/auth";
import { env } from "@moneyroad-app/env/server";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { Jimp } from "jimp";

// 관리자 뉴스 작성 폼의 썸네일 업로드(docs/rfcs/0006 §5-3).
// 토론방 첨부(discussion-media.ts)와 두 가지가 다르다.
//  ① 문턱: 뉴스 작성 자체가 adminProcedure라 업로드도 admin 전용이다.
//  ② 저장소: 뉴스 썸네일은 비로그인도 보는 공개 콘텐츠라 공개 버킷 직접 URL을
//     쓴다(프록시 없음). 자동수집 파이프라인과 같은 버킷·같은 규격이다.

const MB = 1024 * 1024;
const IMAGE_MAX_BYTES = 10 * MB;

/* ----(자동수집 썸네일과 동일 규격 — apps/realtime/src/services/news/thumbnail.ts)---- */
// 목록에서 자동수집분과 관리자 업로드분이 섞여 보이므로 크기·품질·캐시가
// 어긋나면 화질과 비율이 튄다. 아래 4개는 realtime 쪽 상수와 같은 값을 유지한다.
const THUMBNAIL_SIZE = 240;
const THUMBNAIL_QUALITY = 80;
const THUMBNAIL_MIME = "image/jpeg" as const;
const THUMBNAIL_CACHE_CONTROL = "public, max-age=31536000, immutable";
/* ----(~자동수집 썸네일과 동일 규격 여기까지)---- */

// 업로드 시점에는 기사가 아직 없어서(id는 news.create 안에서 생성) 키에 newsId를
// 쓸 수 없다. 자동수집분은 {newsId}.jpg, 업로드분은 {uuid}.jpg — 둘 다 UUID
// 공간이라 같은 프리픽스를 써도 충돌하지 않는다.
const THUMBNAIL_KEY_PREFIX = "news-thumbnails";

// 확장자·선언 MIME은 위조되므로 매직바이트로 판정한 실제 이미지 타입만 받는다.
const IMAGE_MIME_ALLOW = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

let sharedStorage: Storage | null = null;
function getStorage(): Storage {
  if (!sharedStorage) {
    // ADC(로컬 `gcloud auth application-default login`) 또는 Cloud Run SA.
    sharedStorage = new Storage();
  }
  return sharedStorage;
}

/* ----(admin 전용 문턱 — 세션 없음 401, 관리자 아님 403)---- */
// packages/api/src/index.ts의 requireAdmin과 같은 판정(Better Auth admin 플러그인의
// user.role)을 HTTP 라우트에서 되풀이한다. 업로드 라우트는 oRPC 밖이라 그
// 미들웨어를 그대로 재사용할 수 없다. false면 응답을 이미 보냈으니 호출측은 return.
async function ensureAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });
  if (!session) {
    reply
      .status(401)
      .send({ error: "로그인이 필요합니다.", code: "NO_SESSION" });
    return false;
  }
  if (session.user.role !== "admin") {
    reply
      .status(403)
      .send({ error: "관리자 권한이 필요합니다.", code: "FORBIDDEN" });
    return false;
  }
  return true;
}
/* ----(~admin 전용 문턱 여기까지)---- */

// 버킷 env는 선택값이다(realtime도 마찬가지). 미설정 환경에서는 업로드만 꺼지고
// 나머지 뉴스 기능은 그대로 돌아야 하므로 503으로 "기능 꺼짐"을 알린다.
function requireBucket(reply: FastifyReply): string | null {
  const bucket = env.NEWS_THUMBNAIL_BUCKET;
  if (!bucket) {
    reply
      .status(503)
      .send({ error: "썸네일 버킷이 설정되지 않았습니다.", code: "NO_BUCKET" });
    return null;
  }
  return bucket;
}

/* ----(업로드 전건 500 수정 — evlog 로거에 없는 레벨 보강, RFC 0005 §5-1)---- */
// evlog(evlog/fastify `attachLogger`)가 요청마다 `request.log`를 info/warn/error만
// 있는 로거로 갈아끼우는데, @fastify/multipart는 `request.file()` 안에서
// this.log.debug(...)를 부른다. 그래서 보강하지 않으면 첫 바이트에서
// "this.log.debug is not a function"으로 전건 500이 된다(토론방 첨부가 실제로
// 3일간 100% 500이었던 원인). 공용 로거를 건드리지 않고 이 플러그인 컨텍스트에서만 메운다.
const MISSING_LOG_LEVELS = ["trace", "debug", "fatal"] as const;
/* ----(~업로드 전건 500 수정 상수 여기까지)---- */

export function registerNewsMediaPlugin(app: FastifyInstance) {
  /* ----(업로드 전건 500 수정 — 이 플러그인 컨텍스트 한정 로거 훅, RFC 0005 §5-1)---- */
  app.addHook("onRequest", (request, _reply, done) => {
    const log = request.log as unknown as Record<string, unknown>;
    for (const level of MISSING_LOG_LEVELS) {
      if (typeof log[level] !== "function") {
        // 진단용 레벨이라 비워 둬도 evlog가 보고하는 정보는 줄지 않는다.
        log[level] = () => {
          // noop
        };
      }
    }
    done();
  });
  /* ----(~업로드 전건 500 수정 로거 훅 여기까지)---- */

  // multipart 파서를 이 캡슐화 컨텍스트 안에만 두어 oRPC / auth 플러그인의
  // content-type 파서와 섞이지 않게 한다.
  app.register(fastifyMultipart, {
    limits: { fileSize: IMAGE_MAX_BYTES, files: 1 },
    throwFileSizeLimit: true,
  });

  /* ----(관리자 뉴스 썸네일 업로드 — 공개 버킷 직접 URL, RFC 0006 §5-3)---- */
  // 사진 1장 → 240×240 JPEG q80 재인코딩 → 공개 버킷 저장 → 공개 URL 반환.
  // 재인코딩 과정에서 EXIF(GPS 등)가 제거된다. 공개 버킷이라 이 점이 중요하다.
  // 업로드 결과는 어디에도 기록하지 않는다 — 기사 저장 시 news.news_thumbnail에
  // URL이 들어가고, 작성이 취소되면 객체만 남는다(고아 객체 허용).
  app.post("/upload/news-thumbnail", async (request, reply) => {
    if (!(await ensureAdmin(request, reply))) {
      return;
    }
    const bucket = requireBucket(reply);
    if (!bucket) {
      return;
    }

    const part = await request.file({ limits: { fileSize: IMAGE_MAX_BYTES } });
    if (!part) {
      return reply
        .status(400)
        .send({ error: "파일이 없습니다.", code: "NO_FILE" });
    }

    let input: Buffer;
    try {
      input = await part.toBuffer();
    } catch {
      return reply
        .status(413)
        .send({ error: "이미지가 너무 큽니다.", code: "IMAGE_TOO_LARGE" });
    }
    if (part.file.truncated || input.length > IMAGE_MAX_BYTES) {
      return reply
        .status(413)
        .send({ error: "이미지가 너무 큽니다.", code: "IMAGE_TOO_LARGE" });
    }

    const detected = await fileTypeFromBuffer(input);
    if (!(detected && IMAGE_MIME_ALLOW.has(detected.mime))) {
      return reply.status(415).send({
        error: "이미지 파일만 올릴 수 있습니다.",
        code: "BAD_IMAGE_TYPE",
      });
    }

    let output: Buffer;
    try {
      const image = await Jimp.read(input);
      // cover = 짧은 변에 맞춰 채우고 넘치는 쪽을 자른다(가로로 긴 사진은 좌우가
      // 잘린다). 자동수집분과 같은 정사각 규격을 맞추기 위한 의도된 동작이다.
      image.cover({ w: THUMBNAIL_SIZE, h: THUMBNAIL_SIZE });
      output = await image.getBuffer(THUMBNAIL_MIME, {
        quality: THUMBNAIL_QUALITY,
      });
    } catch (err) {
      request.log.warn({ err }, "news thumbnail re-encode failed");
      return reply
        .status(415)
        .send({ error: "읽을 수 없는 이미지입니다.", code: "BAD_IMAGE" });
    }

    const key = `${THUMBNAIL_KEY_PREFIX}/${randomUUID()}.jpg`;
    await getStorage()
      .bucket(bucket)
      .file(key)
      .save(output, {
        metadata: {
          cacheControl: THUMBNAIL_CACHE_CONTROL,
          contentType: THUMBNAIL_MIME,
        },
        resumable: false,
      });

    // 공개 읽기(allUsers → objectViewer)로 열려 있는 버킷이라 서명 URL이 필요 없다.
    return reply.send({
      url: `https://storage.googleapis.com/${bucket}/${key}`,
    });
  });
  /* ----(~관리자 뉴스 썸네일 업로드 여기까지)---- */
}
