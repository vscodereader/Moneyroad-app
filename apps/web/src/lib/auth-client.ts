import { env } from "@moneyroad-app/env/web";
import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  // Enables signIn.oauth2({ providerId }) for Naver/Kakao.
  plugins: [genericOAuthClient()],
});
