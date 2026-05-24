import { expo } from "@better-auth/expo";
import { createDb } from "@moneyroad-app/db";
import * as schema from "@moneyroad-app/db/schema/auth";
import { env } from "@moneyroad-app/env/server";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins/generic-oauth";

// Naver/Kakao return non-OIDC profile shapes, so we map them explicitly.
interface NaverProfile {
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
  };
}

interface KakaoProfile {
  id?: number;
  kakao_account?: {
    email?: string;
    profile?: { nickname?: string; profile_image_url?: string };
  };
}

type GenericOAuthOptions = Parameters<typeof genericOAuth>[0];

// Built-in providers (Google, Apple). Each activates only when its keys are set.
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
  return providers;
}

// Custom OAuth providers (Naver, Kakao) via the genericOAuth plugin.
function buildGenericOAuthConfig(): GenericOAuthOptions["config"] {
  const config: GenericOAuthOptions["config"] = [];
  if (env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) {
    config.push({
      providerId: "naver",
      clientId: env.NAVER_CLIENT_ID,
      clientSecret: env.NAVER_CLIENT_SECRET,
      authorizationUrl: "https://nid.naver.com/oauth2.0/authorize",
      tokenUrl: "https://nid.naver.com/oauth2.0/token",
      userInfoUrl: "https://openapi.naver.com/v1/nid/me",
      scopes: ["email", "name", "profile_image"],
      mapProfileToUser: (profile) => {
        const r = (profile as NaverProfile).response;
        return {
          id: r?.id ?? "",
          email: r?.email ?? "",
          name: r?.name ?? r?.nickname ?? "",
          image: r?.profile_image,
        };
      },
    });
  }
  if (env.KAKAO_CLIENT_ID && env.KAKAO_CLIENT_SECRET) {
    config.push({
      providerId: "kakao",
      clientId: env.KAKAO_CLIENT_ID,
      clientSecret: env.KAKAO_CLIENT_SECRET,
      authorizationUrl: "https://kauth.kakao.com/oauth/authorize",
      tokenUrl: "https://kauth.kakao.com/oauth/token",
      userInfoUrl: "https://kapi.kakao.com/v2/user/me",
      scopes: ["account_email", "profile_nickname", "profile_image"],
      mapProfileToUser: (profile) => {
        const account = (profile as KakaoProfile).kakao_account;
        return {
          id: String((profile as KakaoProfile).id ?? ""),
          email: account?.email ?? "",
          name: account?.profile?.nickname ?? "",
          image: account?.profile?.profile_image_url,
        };
      },
    });
  }
  return config;
}

export function createAuth() {
  const db = createDb(env.DATABASE_URL);

  const oauthConfig = buildGenericOAuthConfig();
  const plugins: NonNullable<BetterAuthOptions["plugins"]> = [expo()];
  if (oauthConfig.length > 0) {
    plugins.push(genericOAuth({ config: oauthConfig }));
  }

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
    plugins,
  });
}

export const auth = createAuth();
