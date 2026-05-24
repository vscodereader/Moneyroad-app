import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CHART_WIDTH = Dimensions.get("window").width - 16;

import { NewsCard, SignalCard } from "@/components/cards";
import { SignalDial, StockChart } from "@/components/charts";
import { Icon } from "@/components/icons";
import {
  BackButton,
  IconButton,
  MrHeader,
  MrScreen,
  SectionHead,
} from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { findStock, news, stocks, threads } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import { type MrTokens, SIGNAL_TYPE_KEYS, signalMeta } from "@/utils/theme";

const RANGES = ["1D", "1W", "1M", "3M", "1Y"];

function scoreVerdict(score: number): string {
  if (score >= 80) {
    return "강한 매수 시그널";
  }
  if (score >= 65) {
    return "매수 우위";
  }
  if (score >= 50) {
    return "중립";
  }
  return "약세 우위";
}

function summaryBgFor(score: number, t: MrTokens): string {
  if (score >= 70) {
    return t.upBg;
  }
  if (score < 50) {
    return t.downBg;
  }
  return t.bgSubtle;
}

function verdictColorFor(score: number, t: MrTokens): string {
  if (score >= 70) {
    return t.upStrong;
  }
  if (score < 50) {
    return t.downStrong;
  }
  return t.fgStrong;
}

export default function StockDetailScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const meta = signalMeta(t);
  const { code } = useLocalSearchParams<{ code: string }>();
  const stock = findStock(code) ?? stocks[0];
  const [range, setRange] = useState("1M");
  const [starred, setStarred] = useState(stock.watched);
  const [openSignal, setOpenSignal] = useState<string | null>(null);

  const up = stock.change > 0;
  const relSignalsQuery = useQuery(
    orpc.signal.feed.queryOptions({
      input: { code: stock.code, window: "24h", limit: 2 },
    })
  );
  const relSignals = relSignalsQuery.data?.items ?? [];
  const relNews = news.filter((n) => n.code === stock.code).slice(0, 2);
  const relThreads = threads.filter((th) => th.code === stock.code).slice(0, 2);

  const summaryBg = summaryBgFor(stock.score, t);
  const verdictColor = verdictColorFor(stock.score, t);

  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
        right={
          <>
            <IconButton onPress={() => setStarred((v) => !v)}>
              <Icon.star
                color={starred ? "#E29A1B" : t.fgSubtle}
                filled={starred}
                size={22}
              />
            </IconButton>
            <IconButton>
              <Icon.share color={t.fgStrong} size={20} />
            </IconButton>
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
          <Text
            style={{
              fontSize: 34,
              fontWeight: "800",
              letterSpacing: -0.5,
              color: t.fgStrong,
            }}
          >
            {fmt.price(stock.price)}
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
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
            >
              {up ? (
                <Icon.arrowUp color={changeColor(stock.change, t)} size={14} />
              ) : (
                <Icon.arrowDown
                  color={changeColor(stock.change, t)}
                  size={14}
                />
              )}
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: changeColor(stock.change, t),
                }}
              >
                {fmt.signedNum(stock.change)} ({fmt.pct(stock.changePct)})
              </Text>
            </View>
            <Text
              style={{ fontSize: 12, color: t.fgSubtle, fontWeight: "500" }}
            >
              오늘
            </Text>
          </View>
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
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Chart */}
        <View style={{ paddingHorizontal: 8, paddingTop: 16 }}>
          <StockChart
            data={stock.chart90}
            height={180}
            positive={up}
            t={t}
            width={CHART_WIDTH}
          />
        </View>

        {/* Composite signal */}
        <SectionHead title="종합 시그널 분석" />
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 16,
              alignItems: "center",
              backgroundColor: t.bgElev,
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <View
              style={{
                width: 120,
                height: 120,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SignalDial breakdown={stock.signalBreakdown} size={120} t={t} />
              <View style={{ position: "absolute", alignItems: "center" }}>
                <Text
                  style={{ fontSize: 11, color: t.fgMuted, fontWeight: "700" }}
                >
                  종합 시그널
                </Text>
                <Text
                  style={{
                    fontSize: 36,
                    fontWeight: "800",
                    color: t.fgStrong,
                    marginTop: 2,
                  }}
                >
                  {stock.score}
                </Text>
                <Text
                  style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}
                >
                  / 100
                </Text>
              </View>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              {SIGNAL_TYPE_KEYS.map((k) => (
                <View
                  key={k}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: meta[k].color,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: "600",
                      color: t.fgMuted,
                    }}
                  >
                    {meta[k].label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: t.fgStrong,
                    }}
                  >
                    {stock.signalBreakdown[k]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View
            style={{
              marginTop: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: summaryBg,
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 12, lineHeight: 18, color: t.fgStrong }}>
              <Text style={{ fontWeight: "800", color: verdictColor }}>
                {scoreVerdict(stock.score)}
              </Text>
              {
                " · 최근 24시간 4개 시그널 종합 점수입니다. 시그널 점수는 매매 권유가 아닙니다."
              }
            </Text>
          </View>
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
        {relNews.map((n) => (
          <NewsCard key={n.id} news={n} showAiChip />
        ))}

        {/* Related discussion */}
        <SectionHead
          more="더보기"
          onMore={() => nav.goTab("discuss")}
          title="관련 토론"
        />
        {relThreads.map((th) => (
          <Pressable
            key={th.id}
            onPress={() => nav.openThread(th.id)}
            style={({ pressed }) => ({
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: pressed ? t.bgSubtle : t.bg,
              borderTopWidth: 1,
              borderTopColor: t.border,
            })}
          >
            <View
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: t.bgMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}
                >
                  {th.author.slice(0, 1)}
                </Text>
              </View>
              <Text
                style={{ fontSize: 11, color: t.fgStrong, fontWeight: "700" }}
              >
                {th.author}
              </Text>
              <Text style={{ fontSize: 11, color: t.fgMuted }}>·</Text>
              <Text
                style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}
              >
                {th.time}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: t.fgStrong,
                marginTop: 6,
                lineHeight: 20,
              }}
            >
              {th.title}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 13,
                color: t.fgMuted,
                marginTop: 4,
                lineHeight: 20,
              }}
            >
              {th.body}
            </Text>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Icon.thumbsUp color={t.fgMuted} size={13} />
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: t.fgMuted }}
                >
                  {th.likes}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Icon.reply color={t.fgMuted} size={13} />
                <Text
                  style={{ fontSize: 12, fontWeight: "600", color: t.fgMuted }}
                >
                  {th.replies}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}

        <View style={{ height: 24 + insets.bottom }} />
      </ScrollView>
    </MrScreen>
  );
}
