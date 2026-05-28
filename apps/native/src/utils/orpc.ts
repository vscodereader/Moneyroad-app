import type { AppRouterClient } from "@moneyroad-app/api/routers/index";
import { env } from "@moneyroad-app/env/native";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // In dev the server attaches the real message + stack (see the server's
      // orpc plugin). Surface both so failures are debuggable from Metro.
      if (__DEV__) {
        const serverStack = (error as { data?: { stack?: string } }).data
          ?.stack;
        console.error("[orpc] query failed:", error.message);
        if (serverStack) {
          console.error("[orpc] server stack:\n", serverStack);
        }
      }
    },
  }),
});

export const link = new RPCLink({
  url: `${env.EXPO_PUBLIC_SERVER_URL}/rpc`,
  fetch(url, options) {
    return fetch(url, {
      ...options,
      // Better Auth Expo forwards the session cookie manually on native.
      credentials: Platform.OS === "web" ? "include" : "omit",
    });
  },
  headers() {
    if (Platform.OS === "web") {
      return {};
    }
    const headers = new Map<string, string>();
    const cookies = authClient.getCookie();
    if (cookies) {
      headers.set("Cookie", cookies);
    }
    return Object.fromEntries(headers);
  },
});

export const client: AppRouterClient = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
