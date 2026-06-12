// MoneyRoad — composite cards & list rows

import { Pressable, Text, View } from "react-native";
import { Gradient, IndexIntradayChart, Sparkline } from "@/components/charts";
import { Icon, SIGNAL_ACTION_ICON } from "@/components/icons";
import { ScorePill, Skeleton, StockLogo, StrengthBar } from "@/components/ui";
import { type LiveIndex, SESSION_MINUTES } from "@/hooks/use-index-stream";
import { useLiveQuote } from "@/hooks/use-live-quotes";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { useStockSparkline } from "@/hooks/use-stock-sparkline";
import type { NewsItem, Signal, Stock } from "@/utils/data";
import { findStock } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { type MrTokens, signalActionMeta } from "@/utils/theme";

// ── Index strip (KOSPI / KOSDAQ) ──────────────────────────────
export function IndexStrip({ indices }: { indices: LiveIndex[] }) {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.border,
        gap: 1,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      {indices.map((idx) => {
        const { change, changePct, prevClose, value } = idx;
        const hasValue =
          value !== null &&
          change !== null &&
          changePct !== null &&
          prevClose !== null;
        if (!hasValue) {
          return (
            <View
              key={idx.name}
              style={{ flex: 1, backgroundColor: t.bg, padding: 12, gap: 2 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}
                >
                  {idx.name}
                </Text>
                <Skeleton height={20} radius={4} width={56} />
              </View>
              <Text
                style={{ fontSize: 17, fontWeight: "800", color: t.fgStrong }}
              >
                시세 연결 중
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}
              >
                지수 데이터를 기다리고 있어요
              </Text>
            </View>
          );
        }
        return (
          <View
            key={idx.name}
            style={{ flex: 1, backgroundColor: t.bg, padding: 12, gap: 2 }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}
              >
                {idx.name}
              </Text>
              <IndexIntradayChart
                height={20}
                prevClose={prevClose}
                series={idx.series}
                sessionMinutes={SESSION_MINUTES}
                t={t}
                width={56}
              />
            </View>
            <Text
              style={{ fontSize: 17, fontWeight: "800", color: t.fgStrong }}
            >
              {fmt.indexValue(value)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: changeColor(change, t),
              }}
            >
              {fmt.signedNum(change)} ({fmt.pct(changePct)})
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Stock row (watchlist / search item) ───────────────────────
export function StockRow({
  stock,
  onPress,
}: {
  stock: Stock;
  onPress?: () => void;
}) {
  const { t } = useMrTheme();
  const up = stock.change > 0;
  const spark = useStockSparkline(stock.code);
  const sparkData = spark.length > 1 ? spark : stock.spark;
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? t.bgSubtle : t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
      })}
    >
      <StockLogo stock={stock} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}
          >
            {stock.name}
          </Text>
          {stock.hot ? (
            <Text style={{ fontSize: 9, fontWeight: "800", color: t.upStrong }}>
              HOT
            </Text>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 11,
            color: t.fgSubtle,
            fontWeight: "500",
            marginTop: 2,
          }}
        >
          {stock.code} · {stock.sector}
        </Text>
        <View style={{ marginTop: 6, flexDirection: "row" }}>
          <ScorePill score={stock.score} />
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Sparkline
          data={sparkData}
          height={22}
          positive={up}
          t={t}
          width={64}
        />
        <Text style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}>
          {fmt.price(stock.price)}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: changeColor(stock.change, t),
          }}
        >
          {fmt.pct(stock.changePct)}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Watchlist row (real watchlist; live quote via store) ──────
export function WatchRow({
  entry,
  onPress,
}: {
  entry: { code: string; market: string; name: string };
  onPress?: () => void;
}) {
  const { t } = useMrTheme();
  // Row-level subscription: this row only re-renders when ITS symbol ticks,
  // not when other rows in the list tick.
  const quote = useLiveQuote(entry.code);
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: pressed ? t.bgSubtle : t.bg,
        borderTopColor: t.border,
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: t.bgSubtle,
          borderRadius: 10,
          height: 36,
          justifyContent: "center",
          width: 36,
        }}
      >
        <Text style={{ color: t.fgMuted, fontSize: 15, fontWeight: "800" }}>
          {entry.name.charAt(0)}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: t.fgStrong, fontSize: 15, fontWeight: "700" }}
        >
          {entry.name}
        </Text>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: 6,
            marginTop: 3,
          }}
        >
          <Text style={{ color: t.fgSubtle, fontSize: 11 }}>{entry.code}</Text>
          <View
            style={{
              backgroundColor: t.bgSubtle,
              borderRadius: 4,
              paddingHorizontal: 6,
              paddingVertical: 1,
            }}
          >
            <Text style={{ color: t.fgMuted, fontSize: 10, fontWeight: "700" }}>
              {entry.market}
            </Text>
          </View>
        </View>
      </View>
      {quote ? (
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text style={{ color: t.fgStrong, fontSize: 14, fontWeight: "800" }}>
            {fmt.price(quote.price)}
          </Text>
          <Text
            style={{
              color: changeColor(quote.change, t),
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {fmt.pct(quote.changeRate)}
          </Text>
        </View>
      ) : (
        <Icon.chevRight color={t.fgSubtle} size={16} />
      )}
    </Pressable>
  );
}

// ── Watchlist row loading placeholder ─────────────────────────
export function WatchRowSkeleton() {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: t.bg,
        borderTopColor: t.border,
        borderTopWidth: 1,
        flexDirection: "row",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <Skeleton height={36} radius={10} width={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <Skeleton height={15} radius={4} width="55%" />
        <Skeleton height={11} radius={4} width={84} />
      </View>
    </View>
  );
}

// Expanded 시그널 카드 안의 종목 미니카드. 별도 컴포넌트로 둬서 카드가 접혀
// 있는 동안엔 useLiveQuote가 호출되지 않아 SSE에 쓸데없이 가입하지 않는다.
function SignalStockRow({
  stock,
  onPress,
  t,
}: {
  stock: Stock;
  onPress?: () => void;
  t: MrTokens;
}) {
  const live = useLiveQuote(stock.code);
  const price = live?.price ?? stock.price;
  const change = live?.change ?? stock.change;
  const changePct = live?.changeRate ?? stock.changePct;
  const spark = useStockSparkline(stock.code);
  const sparkData = spark.length > 1 ? spark : stock.spark;
  return (
    <Pressable
      android_ripple={onPress ? { color: t.bgMuted } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        marginTop: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: pressed && onPress ? t.bgMuted : t.bgSubtle,
        borderRadius: 10,
      })}
    >
      <StockLogo radius={8} size={32} stock={stock} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: t.fgStrong }}>
          {stock.name}
        </Text>
        <Text style={{ fontSize: 11, color: t.fgMuted }}>
          {fmt.price(price)}원 ·{" "}
          <Text style={{ color: changeColor(change, t) }}>
            {fmt.pct(changePct)}
          </Text>
        </Text>
      </View>
      <Sparkline
        data={sparkData}
        height={22}
        positive={change > 0}
        t={t}
        width={56}
      />
      {onPress ? <Icon.chevRight color={t.fgSubtle} size={18} /> : null}
    </Pressable>
  );
}

// ── Signal card (expandable) ──────────────────────────────────
export function SignalCard({
  signal,
  expanded,
  onToggle,
  onStockPress,
  hideStock = false,
}: {
  signal: Signal;
  expanded: boolean;
  onToggle: () => void;
  onStockPress?: () => void;
  hideStock?: boolean;
}) {
  const { t } = useMrTheme();
  const meta = signalActionMeta(t)[signal.action];
  const TypeIcon = SIGNAL_ACTION_ICON[signal.action];
  const stock = findStock(signal.code);

  return (
    <View
      style={{
        backgroundColor: t.bgElev,
        borderWidth: 1,
        borderColor: expanded ? t.borderStrong : t.border,
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/*<View*/}
        {/*  style={{*/}
        {/*    width: 36,*/}
        {/*    height: 36,*/}
        {/*    borderRadius: 10,*/}
        {/*    backgroundColor: meta.bg,*/}
        {/*    alignItems: "center",*/}
        {/*    justifyContent: "center",*/}
        {/*  }}*/}
        {/*>*/}
        {/*  <TypeIcon color={meta.color} size={20} />*/}
        {/*</View>*/}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: meta.color,
                letterSpacing: 0.3,
              }}
            >
              {meta.label}
            </Text>
            {hideStock ? null : (
              <>
                <Text style={{ fontSize: 11, color: t.borderStrong }}>·</Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: t.fgMuted,
                    flexShrink: 1,
                  }}
                >
                  {signal.name}
                </Text>
              </>
            )}
            <Text
              style={{ fontSize: 11, color: t.fgSubtle, marginLeft: "auto" }}
            >
              {signal.time}
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
            {signal.title}
          </Text>
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <StrengthBar color={meta.color} value={signal.strength} />
            </View>
            <Text style={{ fontSize: 11, color: t.fgMuted, fontWeight: "700" }}>
              {signal.strength}/5
            </Text>
          </View>
        </View>
        <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
          <Icon.chevDown color={t.fgSubtle} size={18} />
        </View>
      </Pressable>
      {expanded ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: 16,
            paddingTop: 14,
            borderTopWidth: 1,
            borderTopColor: t.border,
            marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 13, color: t.fgStrong, lineHeight: 21 }}>
            {signal.body}
          </Text>
          {stock ? (
            <SignalStockRow onPress={onStockPress} stock={stock} t={t} />
          ) : null}
          <Text style={{ marginTop: 10, fontSize: 11, color: t.fgSubtle }}>
            ⓘ 매매 권유가 아니며 정보 제공 목적입니다.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ── News thumbnail ────────────────────────────────────────────
function NewsThumb({ news, t }: { news: NewsItem; t: MrTokens }) {
  const up = news.sentiment === "up";
  return (
    <View
      style={{
        width: 78,
        height: 78,
        borderRadius: 8,
        backgroundColor: up ? t.upBg : t.downBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          textAlign: "center",
          lineHeight: 15,
          color: up ? t.upStrong : t.downStrong,
        }}
      >
        {news.thumbHint}
      </Text>
    </View>
  );
}

// ── News card ─────────────────────────────────────────────────
export function NewsCard({
  news,
  onPress,
  showAiChip = false,
}: {
  news: NewsItem;
  onPress?: () => void;
  showAiChip?: boolean;
}) {
  const { t } = useMrTheme();
  const stockName = findStock(news.code)?.name ?? news.stockName;
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed && onPress ? t.bgSubtle : t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
      })}
    >
      <NewsThumb news={news} t={t} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              backgroundColor: t.primarySubtle,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "800", color: t.primary }}>
              {news.category}
            </Text>
          </View>
          {stockName ? (
            <Text style={{ fontSize: 11, fontWeight: "700", color: t.fgMuted }}>
              {stockName}
            </Text>
          ) : null}
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: t.fgStrong,
            marginTop: 4,
            lineHeight: 20,
          }}
        >
          {news.title}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 6,
          }}
        >
          <Text style={{ fontSize: 11, color: t.fgSubtle }}>
            {news.source} · {news.time}
          </Text>
          {showAiChip ? (
            <View
              style={{
                marginLeft: "auto",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                height: 22,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: t.sigAi,
              }}
            >
              <Icon.sparkles color="#fff" size={11} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
                AI 요약
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ── News card loading placeholder ─────────────────────────────
// Mirrors NewsCard's layout (thumb + category/title/meta) with Skeletons.
export function NewsCardSkeleton() {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
      }}
    >
      <Skeleton height={78} radius={8} width={78} />
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Skeleton height={12} radius={4} width={56} />
        <Skeleton height={14} radius={4} width="92%" />
        <Skeleton height={14} radius={4} width="64%" />
        <Skeleton height={11} radius={4} width={110} />
      </View>
    </View>
  );
}

// ── AI daily brief card (home + news) ─────────────────────────
export function AiBriefCard({
  time,
  body,
  onMore,
}: {
  time: string;
  body: string;
  onMore?: () => void;
}) {
  const { t } = useMrTheme();
  return (
    <Gradient
      borderRadius={14}
      colors={["rgba(106,77,214,0.10)", "rgba(37,110,244,0.10)"]}
      style={{ borderWidth: 1, borderColor: t.border }}
    >
      <View style={{ paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon.sparkles color={t.sigAi} size={13} />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              color: t.sigAi,
              letterSpacing: 0.3,
            }}
          >
            AI 데일리 브리프
          </Text>
          <Text
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: t.fgSubtle,
              fontWeight: "600",
            }}
          >
            {time}
          </Text>
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: t.fgStrong,
            marginTop: 8,
            lineHeight: 21,
          }}
        >
          {body}
        </Text>
        {onMore ? (
          <Pressable onPress={onMore} style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: t.primary }}>
              요약 자세히 보기 →
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Gradient>
  );
}

// ── Discussion room row ─────────────────────────────────────
// Mirrors the shape returned by `orpc.discussion.rooms` (one element of the
// array). Defined inline to avoid coupling the UI to server-router internals;
// TS structural matching catches drift at the call site.
export type DiscussionRoomRowData = {
  id: number;
  name: string;
  description: string;
  stockCode: string | null;
  stockName: string | null;
  sentiment: "up" | "neutral" | "down";
  createdBy: { id: string; name: string } | null;
  time: string;
  likesCount: number;
  repliesCount: number;
  membersCount: number;
  liked: boolean;
};

export function DiscussionRoomRow({
  room,
  onToggleLike,
  onPress,
}: {
  room: DiscussionRoomRowData;
  onToggleLike: () => void;
  onPress: () => void;
}) {
  const { t } = useMrTheme();
  const stock = room.stockCode ? findStock(room.stockCode) : null;
  const stockLabel = stock?.name ?? room.stockName;
  const authorName = room.createdBy?.name ?? "관리자";
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: pressed ? t.bgSubtle : t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
      })}
    >
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: stock?.color ?? t.bgMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: stock?.logoTxt ?? "#fff",
            }}
          >
            {authorName.slice(0, 1)}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: t.fgStrong, fontWeight: "700" }}>
          {authorName}
        </Text>
        {stockLabel ? (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              backgroundColor: t.bgSubtle,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: t.fgMuted }}>
              {stockLabel}
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: t.fgMuted,
            fontWeight: "600",
          }}
        >
          {room.time}
        </Text>
      </View>
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: t.fgStrong,
          marginTop: 8,
          lineHeight: 21,
        }}
      >
        {room.name}
      </Text>
      <Text
        numberOfLines={2}
        style={{ fontSize: 13, color: t.fgMuted, marginTop: 4, lineHeight: 20 }}
      >
        {room.description}
      </Text>
      <View
        style={{
          flexDirection: "row",
          gap: 16,
          marginTop: 10,
          alignItems: "center",
        }}
      >
        <Pressable
          hitSlop={6}
          onPress={onToggleLike}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <Icon.thumbsUp
            color={room.liked ? t.upStrong : t.fgMuted}
            filled={room.liked}
            size={15}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: room.liked ? t.upStrong : t.fgMuted,
            }}
          >
            {room.likesCount}
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon.reply color={t.fgMuted} size={15} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            {room.repliesCount}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon.sigComm color={t.fgMuted} size={13} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            {room.membersCount}
          </Text>
        </View>
        {room.sentiment === "neutral" ? null : (
          <View
            style={{
              marginLeft: "auto",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: room.sentiment === "up" ? t.upBg : t.downBg,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: room.sentiment === "up" ? t.upStrong : t.downStrong,
              }}
            >
              {room.sentiment === "up" ? "긍정" : "부정"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export function DiscussionRoomRowSkeleton() {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
      }}
    >
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Skeleton height={28} radius={999} width={28} />
        <Skeleton height={11} radius={4} width={64} />
        <Skeleton height={16} radius={4} width={56} />
        <Skeleton
          height={11}
          radius={4}
          style={{ marginLeft: "auto" }}
          width={40}
        />
      </View>
      <Skeleton height={15} radius={4} style={{ marginTop: 10 }} width="70%" />
      <Skeleton height={13} radius={4} style={{ marginTop: 8 }} width="100%" />
      <Skeleton height={13} radius={4} style={{ marginTop: 6 }} width="45%" />
      <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
        <Skeleton height={13} radius={4} width={28} />
        <Skeleton height={13} radius={4} width={28} />
        <Skeleton height={13} radius={4} width={28} />
      </View>
    </View>
  );
}
