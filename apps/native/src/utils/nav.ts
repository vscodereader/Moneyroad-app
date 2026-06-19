// MoneyRoad — centralized navigation helpers.
// Hrefs are cast to Href here so screens stay clean and typegen state
// (typedRoutes) does not leak casting throughout the codebase.

import { type Href, router } from "expo-router";

import { setOnboarded } from "@/utils/onboarding";

const BASE = "/(moneyroad)";

export type TabName = "home" | "signals" | "news" | "discuss" | "mypage";

export const nav = {
  openStock: (code: string) => router.push(`${BASE}/stock/${code}` as Href),
  // 뉴스 탭으로 이동하며 newsId를 넘겨, 해당 기사 시트를 자동으로 연다(푸시 탭 등).
  openNews: (newsId: string) =>
    router.navigate({
      pathname: `${BASE}/(tabs)/news`,
      params: { newsId },
    } as Href),
  openSearch: () => router.push(`${BASE}/search` as Href),
  openAlerts: () => router.push(`${BASE}/alerts` as Href),
  openWatchlist: () => router.push(`${BASE}/watchlist` as Href),
  openLogin: () => router.push(`${BASE}/login` as Href),
  openDiscussionRoom: (id: number | string) =>
    router.push(`${BASE}/discussion-room/${id}` as Href),
  openCreateDiscussionRoom: () =>
    router.push(`${BASE}/discussion-room/new` as Href),
  openCreateSignal: () => router.push(`${BASE}/signal/new` as Href),
  openManageSignal: () => router.push(`${BASE}/signal/manage` as Href),
  openCreateNotice: () => router.push(`${BASE}/notice/new` as Href),
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
