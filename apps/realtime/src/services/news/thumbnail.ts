import { Storage } from "@google-cloud/storage";
import { log } from "evlog";
import { Jimp } from "jimp";

// 78×78 표시 칸의 최대 3x 밀도까지 커버하는 정사각 썸네일.
const THUMBNAIL_SIZE = 240;
const THUMBNAIL_QUALITY = 80;
const THUMBNAIL_MIME = "image/jpeg" as const;
const THUMBNAIL_CACHE_CONTROL = "public, max-age=31536000, immutable";
const DOWNLOAD_TIMEOUT_MS = 5000;

// GCS 공개 객체 URL.
function buildPublicUrl(bucket: string, key: string): string {
  return `https://storage.googleapis.com/${bucket}/${key}`;
}

function buildThumbnailKey(id: string): string {
  return `news-thumbnails/${id}.jpg`;
}

let sharedStorage: Storage | null = null;
function getStorage(): Storage {
  if (!sharedStorage) {
    // ADC(로컬 `gcloud auth application-default login`) 또는 Cloud Run SA 자동 인증.
    sharedStorage = new Storage();
  }
  return sharedStorage;
}

/**
 * Best-effort: 기사 og:image를 다운로드 → 정사각 썸네일로 리사이즈 → GCS 버킷에
 * 업로드하고 공개 URL을 반환한다. 어떤 단계든 실패하면 null을 반환해, 호출측이
 * 기사 저장을 실패시키지 않고 텍스트 플레이스홀더로 폴백하게 한다.
 */
export async function syncNewsThumbnail(
  id: string,
  imageUrl: string,
  bucketName: string
): Promise<string | null> {
  try {
    const res = await globalThis.fetch(imageUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    const input = Buffer.from(await res.arrayBuffer());

    const image = await Jimp.read(input);
    image.cover({ w: THUMBNAIL_SIZE, h: THUMBNAIL_SIZE });
    const output = await image.getBuffer(THUMBNAIL_MIME, {
      quality: THUMBNAIL_QUALITY,
    });

    const key = buildThumbnailKey(id);
    await getStorage()
      .bucket(bucketName)
      .file(key)
      .save(output, {
        metadata: {
          cacheControl: THUMBNAIL_CACHE_CONTROL,
          contentType: THUMBNAIL_MIME,
        },
        resumable: false,
      });

    return buildPublicUrl(bucketName, key);
  } catch (err) {
    log.warn({ err, newsThumbnail: { event: "sync_failed", id } });
    return null;
  }
}
