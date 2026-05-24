import { expo } from "@better-auth/expo";
import { createDb } from "@moneyroad-app/db";
import * as schema from "@moneyroad-app/db/schema/auth";
import { env } from "@moneyroad-app/env/server";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// Built-in social providers. Each activates only when its keys are set, so the
// server runs with email-only login until credentials are provided.
function buildSocialProviders(): BetterAuthOptions["socialProviders"] {
  const providers: NonNullable<BetterAuthOptions["socialProviders"]> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      ...(env.APPLE_APP_BUNDLE_IDENTIFIER && {
        appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
      }),
    };
  }
  if (env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) {
    providers.naver = {
      clientId: env.NAVER_CLIENT_ID,
      clientSecret: env.NAVER_CLIENT_SECRET,
    };
  }
  if (env.KAKAO_CLIENT_ID && env.KAKAO_CLIENT_SECRET) {
    providers.kakao = {
      clientId: env.KAKAO_CLIENT_ID,
      clientSecret: env.KAKAO_CLIENT_SECRET,
    };
  }
  return providers;
}

export function createAuth() {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    trustedOrigins: [
      env.CORS_ORIGIN,
      // Native deep-link scheme (app.json) — used by OAuth callback redirects.
      "moneyroad.ai.kr://",
      // Sign In with Apple posts back from Apple's domain.
      "https://appleid.apple.com",
      ...(env.NODE_ENV === "development"
        ? [
            "exp://",
            "exp://**",
            "exp://192.168.*.*:*/**",
            "http://localhost:8081",
          ]
        : []),
    ],
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: buildSocialProviders(),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
    plugins: [expo()],
  });
}

export const auth = createAuth();
