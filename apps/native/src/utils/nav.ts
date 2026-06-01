// MoneyRoad — centralized navigation helpers.
// Hrefs are cast to Href here so screens stay clean and typegen state
// (typedRoutes) does not leak casting throughout the codebase.

import { type Href, router } from "expo-router";

import { setOnboarded } from "@/utils/onboarding";

const BASE = "/(moneyroad)";

export type TabName = "home" | "signals" | "news" | "discuss" | "mypage";

export const nav = {
  openStock: (code: string) => router.push(`${BASE}/stock/${code}` as Href),
  openSearch: () => router.push(`${BASE}/search` as Href),
  openAlerts: () => router.push(`${BASE}/alerts` as Href),
  openWatchlist: () => router.push(`${BASE}/watchlist` as Href),
  openLogin: () => router.push(`${BASE}/login` as Href),
  openDiscussionRoom: (id: number | string) =>
    router.push(`${BASE}/discussion-room/${id}` as Href),
  openCreateDiscussionRoom: () =>
    router.push(`${BASE}/discussion-room/new` as Href),
  openCreateSignal: () => router.push(`${BASE}/signal/new` as Href),
  openSettings: (page: string) =>
    router.push(`${BASE}/settings/${page}` as Href),
  goTab: (name: TabName) =>
    router.navigate(
      `${BASE}/(tabs)${name === "home" ? "" : `/${name}`}` as Href
    ),
  finishOnboarding: () => {
    setOnboarded(true);
    router.replace(`${BASE}/(tabs)` as Href);
  },
  back: () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`${BASE}/(tabs)` as Href);
    }
  },
};
