import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CHART_WIDTH = Dimensions.get("window").width - 16;

import { DiscussionRoomRow, NewsCard, SignalCard } from "@/components/cards";
// import { SignalDial, StockChart } from "@/components/charts";
import { StockChart } from "@/components/charts";
import { Icon } from "@/components/icons";
import {
  BackButton,
  IconButton,
  MrHeader,
  MrScreen,
  SectionHead,
} from "@/components/ui";
import { type LiveQuote, useLiveQuote } from "@/hooks/use-live-quotes";
import { useMrTheme } from "@/hooks/use-mr-theme";
import {
  STOCK_CHART_RANGE_LABELS,
  STOCK_CHART_RANGES,
  type StockChartRange,
  useStockChart,
} from "@/hooks/use-stock-chart";
import { authClient } from "@/lib/auth-client";
import { findStock, type Stock } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";

const RANGES: readonly StockChartRange[] = STOCK_CHART_RANGES;

function QuoteSummary({
  live,
  t,
}: {
  live: LiveQuote | undefined;
  t: MrTokens;
}) {
  if (!live) {
    return (
      <View style={{ paddingVertical: 8 }}>
        <Text style={{ color: t.fgStrong, fontSize: 22, fontWeight: "800" }}>
          시세 연결 중
        </Text>
        <Text
          style={{
            color: t.fgMuted,
            fontSize: 13,
            fontWeight: "600",
            marginTop: 6,
          }}
        >
          실시간 시세를 기다리고 있어요.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Text
        style={{
          fontSize: 34,
          fontWeight: "800",
          letterSpacing: -0.5,
          color: t.fgStrong,
        }}
      >
        {fmt.price(live.price)}
        <Text style={{ fontSize: 16, fontWeight: "600", color: t.fgMuted }}>
          {" "}
          원
        </Text>
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: changeColor(live.change, t),
            }}
          >
            {fmt.signedNum(live.change)} ({fmt.pct(live.changeRate)})
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: t.fgSubtle, fontWeight: "500" }}>
          오늘
        </Text>
      </View>
    </>
  );
}

function StockNotFoundView() {
  const { t } = useMrTheme();

  return (
    <MrScreen>
      <MrHeader left={<BackButton onPress={nav.back} />} title="종목 정보" />
      <View
        style={{
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Icon.alert color={t.fgMuted} size={40} />
        <Text
          style={{
            color: t.fgStrong,
            fontSize: 18,
            fontWeight: "800",
            marginTop: 16,
            textAlign: "center",
          }}
        >
          종목 정보를 찾을 수 없습니다
        </Text>
        <Text
          style={{
            color: t.fgMuted,
            fontSize: 14,
            fontWeight: "600",
            lineHeight: 20,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          검색이나 관심 종목에서 다시 선택해 주세요.
        </Text>
      </View>
    </MrScreen>
  );
}

export default function StockDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const stock = code ? findStock(code) : undefined;

  if (!stock) {
    return <StockNotFoundView />;
  }

  return <StockDetailContent stock={stock} />;
}

function StockDetailContent({ stock }: { stock: Stock }) {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState<StockChartRange>("1D");
  const [openSignal, setOpenSignal] = useState<string | null>(null);

  const live = useLiveQuote(stock.code);
  const up = live ? live.change > 0 : false;

  // Range별 차트 시리즈(가격+거래량+prevClose)를 realtime 프록시에서 가져옴.
  // 1D에 한해 마지막 점의 가격을 라이브 가격으로 갱신해 헤더 가격과 차트 끝점이
  // 어긋나지 않게 한다.
  const seriesRaw = useStockChart(stock.code, range);
  const lastSeed = seriesRaw.points.at(-1);
  const series =
    range === "1D" && live && lastSeed
      ? {
          ...seriesRaw,
          points: [
            ...seriesRaw.points.slice(0, -1),
            { ...lastSeed, v: live.price },
          ],
        }
      : seriesRaw;
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isAuthed = Boolean(session?.user);

  // 워치리스트 server state로 별 토글 상태를 결정. 로컬 starred state 없이도
  // 다른 화면에서의 변경(워치리스트 화면 추가/제거)이 즉시 반영된다.
  const watchlistQuery = useQuery(
    orpc.watchlist.list.queryOptions({ enabled: isAuthed })
  );
  const watchlistKey = orpc.watchlist.list.queryKey();
  const isWatched = (watchlistQuery.data ?? []).some(
    (w) => w.code === stock.code
  );
  const invalidateWatchlist = () =>
    queryClient.invalidateQueries({ queryKey: watchlistKey });
  const addWatchMut = useMutation(
    orpc.watchlist.add.mutationOptions({ onSettled: invalidateWatchlist })
  );
  const removeWatchMut = useMutation(
    orpc.watchlist.remove.mutationOptions({ onSettled: invalidateWatchlist })
  );

  const toggleWatch = () => {
    if (!isAuthed) {
      Alert.alert(
        "로그인이 필요해요",
        "관심 종목 등록은 로그인 후 이용할 수 있어요."
      );
      return;
    }
    if (isWatched) {
      Alert.alert(
        "관심 종목 해제",
        `${stock.name}을(를) 관심 종목에서 해제할까요?`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "해제",
            style: "destructive",
            onPress: () => removeWatchMut.mutate({ stockCode: stock.code }),
          },
        ]
      );
      return;
    }
    Alert.alert(
      "관심 종목 등록",
      `${stock.name}을(를) 관심 종목에 추가할까요?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "등록",
          onPress: () => addWatchMut.mutate({ stockCode: stock.code }),
        },
      ]
    );
  };

  const relSignalsQuery = useQuery(
    orpc.signal.feed.queryOptions({
      input: { code: stock.code, window: "all", limit: 2 },
    })
  );
  const relSignals = relSignalsQuery.data?.items ?? [];

  const relNewsQuery = useQuery(
    orpc.news.feed.queryOptions({ input: { code: stock.code, limit: 2 } })
  );
  const relNews = relNewsQuery.data?.items ?? [];

  const relRoomsOptions = orpc.discussion.rooms.queryOptions({
    input: { tab: "recent", stockCode: stock.code },
  });
  const relRoomsQuery = useQuery(relRoomsOptions);
  const relRooms = (relRoomsQuery.data ?? []).slice(0, 2);

  const toggleLike = useMutation(
    orpc.discussion.toggleLike.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: relRoomsOptions.queryKey }),
    })
  );
  const handleToggleLike = (roomId: number) => {
    if (!isAuthed) {
      return;
    }
    toggleLike.mutate({ roomId });
  };

  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
        right={
          <>
            <IconButton onPress={toggleWatch}>
              <Icon.star
                color={isWatched ? t.sigTech : t.fgSubtle}
                filled={isWatched}
                size={22}
              />
            </IconButton>
            {/*<IconButton>*/}
            {/*  <Icon.share color={t.fgStrong} size={20} />*/}
            {/*</IconButton>*/}
          </>
        }
        title={
          <View>
            <Text
              style={{ fontSize: 16, fontWeight: "800", color: t.fgStrong }}
            >
              {stock.name}
            </Text>
            <Text style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}>
              {stock.code} · {stock.sector}
            </Text>
          </View>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Price */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <QuoteSummary live={live} t={t} />
        </View>

        {/* Chart range tabs */}
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            paddingHorizontal: 16,
            paddingTop: 16,
            borderBottomWidth: 1,
            borderBottomColor: t.border,
          }}
        >
          {RANGES.map((r) => {
            const active = r === range;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: "center",
                  borderBottomWidth: 2,
                  borderBottomColor: active ? t.fgStrong : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: active ? t.fgStrong : t.fgMuted,
                  }}
                >
                  {STOCK_CHART_RANGE_LABELS[r]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Chart */}
        <View style={{ paddingHorizontal: 8, paddingTop: 16 }}>
          {series.points.length > 1 ? (
            <StockChart
              height={220}
              positive={up}
              range={range}
              series={series}
              t={t}
              width={CHART_WIDTH}
            />
          ) : (
            <View
              style={{
                alignItems: "center",
                height: 220,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: t.fgSubtle, fontSize: 13 }}>
                차트 데이터를 불러오는 중…
              </Text>
            </View>
          )}
        </View>

        {/* Recent signals */}
        <SectionHead more="더보기" title="최근 시그널" />
        {relSignals.length > 0 ? (
          relSignals.map((sig) => (
            <SignalCard
              expanded={openSignal === sig.id}
              hideStock
              key={sig.id}
              onToggle={() =>
                setOpenSignal(openSignal === sig.id ? null : sig.id)
              }
              signal={sig}
            />
          ))
        ) : (
          <View style={{ padding: 40 }}>
            <Text
              style={{ textAlign: "center", color: t.fgMuted, fontSize: 14 }}
            >
              최근 24시간 신규 시그널이 없습니다.
            </Text>
          </View>
        )}

        {/* Related news */}
        <SectionHead
          more="더보기"
          onMore={() => nav.goTab("news")}
          title="관련 뉴스"
        />
        {relNews.length > 0 ? (
          relNews.map((n) => <NewsCard key={n.id} news={n} showAiChip />)
        ) : (
          <View style={{ padding: 40 }}>
            <Text
              style={{ textAlign: "center", color: t.fgMuted, fontSize: 14 }}
            >
              관련 뉴스가 아직 없어요.
            </Text>
          </View>
        )}

        {/* Related discussion */}
        <SectionHead
          more="더보기"
          onMore={() => nav.goTab("discuss")}
          title="관련 토론"
        />
        {relRooms.length > 0 ? (
          relRooms.map((r) => (
            <DiscussionRoomRow
              key={r.id}
              onPress={() => nav.openDiscussionRoom(r.id)}
              onToggleLike={() => handleToggleLike(r.id)}
              room={r}
            />
          ))
        ) : (
          <View style={{ padding: 40 }}>
            <Text
              style={{ textAlign: "center", color: t.fgMuted, fontSize: 14 }}
            >
              관련 토론방이 아직 없어요.
            </Text>
          </View>
        )}

        <View style={{ height: 24 + insets.bottom }} />
      </ScrollView>
    </MrScreen>
  );
}
