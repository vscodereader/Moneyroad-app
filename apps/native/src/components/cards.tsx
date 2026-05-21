// MoneyRoad — composite cards & list rows

import { Pressable, Text, View } from "react-native";
import { Gradient, Sparkline } from "@/components/charts";
import { Icon, SIGNAL_TYPE_ICON } from "@/components/icons";
import { ScorePill, StockLogo, StrengthBar } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import type {
  MarketIndex,
  NewsItem,
  Signal,
  Stock,
  Thread,
} from "@/utils/data";
import { findStock } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { type MrTokens, signalMeta } from "@/utils/theme";

// ── Index strip (KOSPI / KOSDAQ) ──────────────────────────────
export function IndexStrip({ indices }: { indices: MarketIndex[] }) {
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
      {indices.map((idx) => (
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
            <Text style={{ fontSize: 11, color: t.fgMuted, fontWeight: "600" }}>
              {idx.name}
            </Text>
            <Sparkline
              data={[
                100,
                102,
                99,
                101,
                103,
                100,
                102,
                105,
                103,
                idx.change > 0 ? 108 : 96,
              ]}
              height={16}
              positive={idx.change > 0}
              t={t}
              width={48}
            />
          </View>
          <Text style={{ fontSize: 17, fontWeight: "800", color: t.fgStrong }}>
            {fmt.indexValue(idx.value)}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: changeColor(idx.change, t),
            }}
          >
            {fmt.signedNum(idx.change)} ({fmt.pct(idx.changePct)})
          </Text>
        </View>
      ))}
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
          data={stock.spark}
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

// ── Signal card (expandable) ──────────────────────────────────
export function SignalCard({
  signal,
  expanded,
  onToggle,
  hideStock = false,
}: {
  signal: Signal;
  expanded: boolean;
  onToggle: () => void;
  hideStock?: boolean;
}) {
  const { t } = useMrTheme();
  const meta = signalMeta(t)[signal.type];
  const TypeIcon = SIGNAL_TYPE_ICON[signal.type];
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
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: meta.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TypeIcon color={meta.color} size={20} />
        </View>
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
            {!hideStock && stock ? (
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
                  {stock.name}
                </Text>
              </>
            ) : null}
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
            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: t.bgSubtle,
                borderRadius: 10,
              }}
            >
              <StockLogo radius={8} size={32} stock={stock} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: t.fgStrong }}
                >
                  {stock.name}
                </Text>
                <Text style={{ fontSize: 11, color: t.fgMuted }}>
                  {fmt.price(stock.price)}원 ·{" "}
                  <Text style={{ color: changeColor(stock.change, t) }}>
                    {fmt.pct(stock.changePct)}
                  </Text>
                </Text>
              </View>
              <Sparkline
                data={stock.spark}
                height={22}
                positive={stock.change > 0}
                t={t}
                width={56}
              />
            </View>
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
  const stock = findStock(news.code);
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
          {stock ? (
            <Text style={{ fontSize: 11, fontWeight: "700", color: t.fgMuted }}>
              {stock.name}
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

// ── Discussion thread row ─────────────────────────────────────
export function ThreadRow({
  thread,
  liked,
  onToggleLike,
  onPress,
}: {
  thread: Thread;
  liked: boolean;
  onToggleLike: () => void;
  onPress: () => void;
}) {
  const { t } = useMrTheme();
  const stock = findStock(thread.code);
  const likeCount = thread.likes + (liked ? 1 : 0);
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
            {thread.author.slice(0, 1)}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: t.fgStrong, fontWeight: "700" }}>
          {thread.author}
        </Text>
        {stock ? (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              backgroundColor: t.bgSubtle,
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: t.fgMuted }}>
              {stock.name}
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
          {thread.time}
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
        {thread.title}
      </Text>
      <Text
        numberOfLines={2}
        style={{ fontSize: 13, color: t.fgMuted, marginTop: 4, lineHeight: 20 }}
      >
        {thread.body}
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
            color={liked ? t.upStrong : t.fgMuted}
            filled={liked}
            size={15}
          />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: liked ? t.upStrong : t.fgMuted,
            }}
          >
            {likeCount}
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon.reply color={t.fgMuted} size={15} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            {thread.replies}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon.sigComm color={t.fgMuted} size={13} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            {thread.members}
          </Text>
        </View>
        {thread.sentiment === "neutral" ? null : (
          <View
            style={{
              marginLeft: "auto",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: thread.sentiment === "up" ? t.upBg : t.downBg,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: thread.sentiment === "up" ? t.upStrong : t.downStrong,
              }}
            >
              {thread.sentiment === "up" ? "긍정" : "부정"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
