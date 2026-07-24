import { env } from "@moneyroad-app/env/native";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

// Multipart upload + media-source helpers for discussion-room attachments
// (docs/rfcs/0004 기능5). Mirrors the oRPC link's cookie handling: Better Auth
// Expo forwards the session cookie manually on native, so every request to the
// server's /upload/* and /media/* routes must carry it explicitly.

export type UploadedFileRef = {
  bucket: string;
  key: string;
  mime: string;
  size: number;
  name: string;
};

type LocalFile = { uri: string; name: string; mime: string };

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (Platform.OS !== "web") {
    const cookies = authClient.getCookie();
    if (cookies) {
      headers.Cookie = cookies;
    }
  }
  return headers;
}

// Absolute URL for a server-relative media path (the messages payload returns
// paths like "/media/chat-image/42").
export function mediaUrl(path: string): string {
  return path.startsWith("http")
    ? path
    : `${env.EXPO_PUBLIC_SERVER_URL}${path}`;
}

// expo-image source for an access-checked media path, attaching the session
// cookie on native so the private-bucket proxy authorizes the request.
export function mediaSource(path: string): {
  uri: string;
  headers?: Record<string, string>;
} {
  const uri = mediaUrl(path);
  const headers = authHeaders();
  return Object.keys(headers).length > 0 ? { uri, headers } : { uri };
}

async function postFile(endpoint: string, file: LocalFile): Promise<Response> {
  const form = new FormData();
  // React Native FormData file part — the { uri, name, type } triple is the
  // documented shape (not a real Blob). fetch sets the multipart Content-Type
  // + boundary automatically, so we only add the cookie header.
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mime,
  } as unknown as Blob);
  return await fetch(`${env.EXPO_PUBLIC_SERVER_URL}${endpoint}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
    credentials: Platform.OS === "web" ? "include" : "omit",
  });
}

// POST /upload/chat-image → { imageId }. Throws on any non-2xx so the caller can
// treat this upload as failed (partial-failure retry lives in the screen).
export async function uploadChatImage(file: LocalFile): Promise<number> {
  const res = await postFile("/upload/chat-image", file);
  if (!res.ok) {
    throw new Error(`이미지 업로드 실패 (${res.status})`);
  }
  const data = (await res.json()) as { imageId: number };
  return data.imageId;
}

// POST /upload/chat-file → { bucket, key, mime, size, name }.
export async function uploadChatFile(
  file: LocalFile
): Promise<UploadedFileRef> {
  const res = await postFile("/upload/chat-file", file);
  if (!res.ok) {
    throw new Error(`파일 업로드 실패 (${res.status})`);
  }
  return (await res.json()) as UploadedFileRef;
}
