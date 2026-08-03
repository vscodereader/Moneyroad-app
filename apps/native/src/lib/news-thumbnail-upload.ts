import { env } from "@moneyroad-app/env/native";
import { Platform } from "react-native";

import { authHeaders } from "@/lib/discussion-upload";

/* ----(관리자 뉴스 썸네일 업로드 클라이언트 — docs/rfcs/0006 §5-2)---- */
// 토론방 첨부(discussion-upload.ts)와 두 가지가 다르다.
//  1) 응답이 imageId가 아니라 공개 GCS URL 문자열이다. 뉴스 썸네일은 비로그인도
//     보는 공개 콘텐츠라 비공개 버킷 + 서버 프록시를 쓰지 않는다(RFC 0006 §3-2).
//  2) 라우트가 admin 전용이다. 뉴스 작성 자체가 adminProcedure라 문턱을 맞췄다.
// 세션 쿠키는 native에서 자동으로 붙지 않으므로 토론방과 같은 authHeaders()를
// 그대로 재사용한다(중복 구현하면 쿠키 처리가 두 벌로 갈라진다).

export type LocalThumbnailFile = { uri: string; name: string; mime: string };

// 서버가 내려주는 상태코드별 한국어 안내. 관리자가 원인을 바로 알아야 다음
// 행동(다른 사진 고르기 / 재로그인 / 담당자 문의)이 갈린다.
const UPLOAD_ERROR_BY_STATUS: Record<number, string> = {
  401: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  403: "썸네일을 올릴 권한이 없습니다.",
  413: "이미지가 너무 큽니다. 10MB 이하로 골라 주세요.",
  415: "이미지 파일만 올릴 수 있습니다.",
  503: "썸네일 저장소가 준비되지 않았습니다. 관리자에게 문의해 주세요.",
};

function uploadErrorOf(status: number): Error {
  const message =
    UPLOAD_ERROR_BY_STATUS[status] ??
    `썸네일 업로드에 실패했습니다. (${status})`;
  return new Error(message);
}

// POST /upload/news-thumbnail → { url }. 실패하면 던진다 — 호출부는 이 예외를
// 보고 기사 저장 자체를 중단해야 한다(썸네일만 빠진 채로 저장되면 안 된다).
export async function uploadNewsThumbnail(
  file: LocalThumbnailFile
): Promise<string> {
  const form = new FormData();
  // React Native FormData의 파일 파트는 실제 Blob이 아니라 { uri, name, type }
  // 삼총사다(RN 문서 규격). Content-Type/boundary는 fetch가 채운다.
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mime,
  } as unknown as Blob);

  const res = await fetch(
    `${env.EXPO_PUBLIC_SERVER_URL}/upload/news-thumbnail`,
    {
      method: "POST",
      headers: authHeaders(),
      body: form,
      credentials: Platform.OS === "web" ? "include" : "omit",
    }
  );
  if (!res.ok) {
    throw uploadErrorOf(res.status);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
/* ----(~관리자 뉴스 썸네일 업로드 클라이언트 여기까지)---- */
