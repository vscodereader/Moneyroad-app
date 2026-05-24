import { env } from "@moneyroad-app/env/native";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

/**
 * Mints a short-lived signed token from the API server for connecting to the
 * realtime SSE service. Mirrors the oRPC link's cookie handling (Better Auth
 * Expo forwards the session cookie manually on native). Returns null on failure.
 */
export async function fetchStreamToken(): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (Platform.OS !== "web") {
      const cookies = authClient.getCookie();
      if (cookies) {
        headers.Cookie = cookies;
      }
    }
    const res = await fetch(`${env.EXPO_PUBLIC_SERVER_URL}/stream-token`, {
      method: "POST",
      headers,
      credentials: Platform.OS === "web" ? "include" : "omit",
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}
