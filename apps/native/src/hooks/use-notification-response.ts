import * as Notifications from "expo-notifications";
import { useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";

import { nav } from "@/utils/nav";

type PushData = {
  newsId?: unknown;
  stockCode?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * 알림 payload를 보고 해당 화면으로 이동한다. 속보(breaking_news)는 newsId가
 * 있어 뉴스 기사로, 가격 알림·시그널은 stockCode가 있어 종목 상세로 보낸다.
 */
function routeFromData(data: PushData): void {
  const newsId = asString(data.newsId);
  if (newsId) {
    nav.openNews(newsId);
    return;
  }
  const stockCode = asString(data.stockCode);
  if (stockCode) {
    nav.openStock(stockCode);
  }
}

/**
 * 알림 탭(포그라운드·백그라운드·종료 후 콜드스타트)을 처리해 해당 화면으로
 * 딥링크한다. 앱 루트에서 1회 마운트한다. `useLastNotificationResponse`는 앱을
 * 띄운 탭과 이후 들어온 탭을 모두 반영하므로, identifier로 중복 처리만 막는다.
 * 루트 내비게이터가 준비된 뒤 이동하도록 `useRootNavigationState`로 게이트한다.
 */
export function useNotificationResponse(): void {
  const lastResponse = Notifications.useLastNotificationResponse();
  const navState = useRootNavigationState();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!(lastResponse && navState?.key)) {
      return;
    }
    const id = lastResponse.notification.request.identifier;
    if (handledId.current === id) {
      return;
    }
    handledId.current = id;
    routeFromData(lastResponse.notification.request.content.data as PushData);
  }, [lastResponse, navState?.key]);
}
