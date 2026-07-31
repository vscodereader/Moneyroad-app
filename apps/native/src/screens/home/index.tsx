import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  // AiBriefCard,
  IndexStrip,
  NewsCard,
  NewsCardSkeleton,
  SignalCard,
  WatchRow,
  WatchRowSkeleton,
} from "@/components/cards";
import { Icon } from "@/components/icons";
import { IconButton, MrHeader, MrScreen, SectionHead } from "@/components/ui";
import { useIndexStream } from "@/hooks/use-index-stream";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { authClient } from "@/lib/auth-client";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";

const NEWS_SKELETON_KEYS = [
  "news-skeleton-1",
  "news-skeleton-2",
  "news-skeleton-3",
];
const WATCHLIST_SKELETON_KEYS = ["watch-skeleton-1", "watch-skeleton-2"];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "좋은 아침이에요";
  }
  if (hour < 18) {
    return "오늘 시장도 함께 살펴봐요";
  }
  return "장 마감 후 정리해볼까요";
}

function EmptyHint({
  label,
  onPress,
  t,
}: {
  label: string;
  onPress?: () => void;
  t: MrTokens;
}) {
  const boxStyle = {
    alignItems: "center" as const,
    backgroundColor: t.bgSubtle,
    borderRadius: 12,
    gap: 8,
    marginHorizontal: 16,
    paddingVertical: 28,
  };
  const content = (
    <>
      <Icon.navWatch color={t.fgSubtle} size={26} />
      <Text style={{ color: t.fgSubtle, fontSize: 13, textAlign: "center" }}>
        {label}
      </Text>
    </>
  );
  if (!onPress) {
    return <View style={boxStyle}>{content}</View>;
  }
  return (
    <Pressable
      android_ripple={{ color: t.bgMuted }}
      onPress={onPress}
      style={({ pressed }) => [boxStyle, pressed ? { opacity: 0.7 } : null]}
    >
      {content}
    </Pressable>
  );
}

function WatchlistPreview({
  items,
  isLoading,
  onOpenWatchlist,
  t,
}: {
  items: {
    code: string;
    iconUrl?: null | string;
    market: string;
    name: string;
  }[];
  isLoading: boolean;
  onOpenWatchlist: () => void;
  t: MrTokens;
}) {
  if (isLoading) {
    return (
      <>
        {WATCHLIST_SKELETON_KEYS.map((key) => (
          <WatchRowSkeleton key={key} />
        ))}
      </>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyHint
        label="관심 종목이 아직 없어요."
        onPress={onOpenWatchlist}
        t={t}
      />
    );
  }
  return (
    <>
      {items.map((entry) => (
        <WatchRow
          entry={entry}
          key={entry.code}
          onPress={() => nav.openStock(entry.code)}
        />
      ))}
    </>
  );
}

export default function HomeScreen() {
  const { t } = useMrTheme();
  const [openSigId, setOpenSigId] = useState<string | null>(null);
  const { runProtected } = useProtectedAction();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const displayName = session?.user?.name?.trim() || "투자자";
  const indices = useIndexStream();
  const topSignalsQuery = useQuery(orpc.signal.preview.queryOptions());
  const topSignals = topSignalsQuery.data?.items ?? [];
  const newsQuery = useQuery(
    orpc.news.feed.queryOptions({ input: { tab: "all", limit: 3 } })
  );
  const topNews = newsQuery.data?.items ?? [];
  // Real watchlist (codes/names/market); price/score await the market API.
  const watchlistQuery = useQuery(
    orpc.watchlist.list.queryOptions({ enabled: isLoggedIn })
  );
  const watched = watchlistQuery.data ?? [];
  const watchedPreview = watched.slice(0, 4);
  // 시세 구독은 WatchRow가 코드별로 store에 직접 register하므로 여기선 없음.
  // 미읽음 알림이 있을 때만 종 아이콘에 dot 표시.
  const unreadCountQuery = useQuery(
    orpc.notification.unreadCount.queryOptions({ enabled: isLoggedIn })
  );
  const hasUnreadAlerts = (unreadCountQuery.data ?? 0) > 0;
  const openAlerts = () =>
    runProtected({
      returnTo: "/(moneyroad)/alerts",
      action: nav.openAlerts,
    });
  const openWatchlist = () =>
    runProtected({
      returnTo: "/(moneyroad)/watchlist",
      action: nav.openWatchlist,
    });

  return (
    <MrScreen>
      <MrHeader
        right={
          <>
            {/*TODO: 나중에 기능 추가 개발 필요 데이터 수집 한계 초과 가능할시 .. kis 는 40개 제한이라..*/}
            {/*<IconButton onPress={nav.openSearch}>*/}
            {/*  <Icon.search color={t.fgStrong} size={22} />*/}
            {/*</IconButton>*/}
            <IconButton dot={hasUnreadAlerts} onPress={openAlerts}>
              <Icon.bell color={t.fgStrong} size={22} />
            </IconButton>
          </>
        }
        title={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: t.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.logo color="#fff" size={18} />
            </View>
            <Text
              style={{
                fontSize: 19,
                fontWeight: "800",
                letterSpacing: -0.4,
                color: t.fgStrong,
              }}
            >
              머니<Text style={{ color: t.primary }}>로드</Text>
            </Text>
          </View>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
        >
          {isLoggedIn ? (
            <Text style={{ fontSize: 12, fontWeight: "600", color: t.fgMuted }}>
              {displayName} 님,
            </Text>
          ) : null}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: t.fgStrong,
              letterSpacing: -0.3,
              marginTop: 2,
            }}
          >
            {greeting()}
          </Text>
        </View>

        <IndexStrip indices={indices} />

        {/*<View style={{ paddingHorizontal: 16, paddingTop: 16 }}>*/}
        {/*  <AiBriefCard*/}
        {/*    body="관심 종목 6건 중 4건이 긍정 이벤트. 두산에너빌리티 체코 원전 본계약과 SK하이닉스 HBM4 양산 일정 단축이 오늘의 핵심."*/}
        {/*    time="오전 7:30"*/}
        {/*  />*/}
        {/*</View>*/}

        <SectionHead
          more={
            isLoggedIn && watched.length > 0
              ? `전체보기 (${watched.length}) →`
              : undefined
          }
          onMore={isLoggedIn && watched.length > 0 ? openWatchlist : undefined}
          title="내 관심 종목"
        />
        <View style={{ paddingBottom: 8 }}>
          {isLoggedIn ? (
            <WatchlistPreview
              isLoading={watchlistQuery.isLoading}
              items={watchedPreview}
              onOpenWatchlist={openWatchlist}
              t={t}
            />
          ) : (
            <EmptyHint
              label="로그인하고 관심 종목을 추가해 보세요."
              onPress={openWatchlist}
              t={t}
            />
          )}
        </View>

        <SectionHead
          more="전체보기 →"
          onMore={() => nav.goTab("signals")}
          title="오늘의 시그널"
        />
        {topSignals.map((sig) => (
          <SignalCard
            expanded={openSigId === sig.id}
            key={sig.id}
            onStockPress={() => nav.openStock(sig.code)}
            onToggle={() => setOpenSigId(openSigId === sig.id ? null : sig.id)}
            signal={sig}
          />
        ))}
        {topSignals.length === 0 ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: t.bgSubtle,
              borderRadius: 12,
              gap: 8,
              marginHorizontal: 16,
              paddingVertical: 28,
            }}
          >
            {topSignalsQuery.isLoading ? (
              <ActivityIndicator color={t.primary} />
            ) : (
              <>
                <Icon.navSignal color={t.fgSubtle} size={26} />
                <Text style={{ color: t.fgSubtle, fontSize: 13 }}>
                  오늘의 시그널이 아직 없어요.
                </Text>
              </>
            )}
          </View>
        ) : null}

        <SectionHead
          more="전체보기 →"
          onMore={() => nav.goTab("news")}
          title="주요 뉴스"
        />
        {(() => {
          if (newsQuery.isLoading) {
            return NEWS_SKELETON_KEYS.map((key) => (
              <NewsCardSkeleton key={key} />
            ));
          }
          if (topNews.length === 0) {
            return <EmptyHint label="표시할 뉴스가 아직 없어요." t={t} />;
          }
          return topNews.map((n) => <NewsCard key={n.id} news={n} />);
        })()}

        <View style={{ height: 24 }} />
      </ScrollView>
    </MrScreen>
  );
}
