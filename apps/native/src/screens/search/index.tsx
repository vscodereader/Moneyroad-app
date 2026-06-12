import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icons";
import { BackButton, MrScreen, SectionHead, StockLogo } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { findStock, recent, type Stock, stocks, trending } from "@/utils/data";
import { nav } from "@/utils/nav";
import type { MrTokens } from "@/utils/theme";

function ResultRow({ stock, t }: { stock: Stock; t: MrTokens }) {
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      onPress={() => nav.openStock(stock.code)}
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
        <Text style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}>
          {stock.name}
        </Text>
        <Text
          style={{
            fontSize: 11,
            color: t.fgSubtle,
            fontWeight: "500",
            marginTop: 2,
          }}
        >
          {stock.code} · {stock.sector}
        </Text>
      </View>
      <Text style={{ color: t.fgSubtle, fontSize: 11, fontWeight: "700" }}>
        시세 연결 전
      </Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const query = q.trim();
  const results = query
    ? stocks.filter(
        (s) =>
          s.name.includes(query) ||
          s.code.includes(query) ||
          s.sector.includes(query)
      )
    : null;
  const trendingStocks = trending
    .map((c) => findStock(c))
    .filter((s): s is Stock => Boolean(s));

  return (
    <MrScreen>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: t.bg,
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <BackButton onPress={nav.back} />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: t.bgSubtle,
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 40,
          }}
        >
          <Icon.search color={t.fgSubtle} size={18} />
          <TextInput
            autoFocus
            onChangeText={setQ}
            placeholder="종목명·종목코드로 검색"
            placeholderTextColor={t.fgSubtle}
            style={{
              flex: 1,
              fontSize: 15,
              color: t.fg,
              fontWeight: "500",
              padding: 0,
            }}
            value={q}
          />
          {q ? (
            <Pressable hitSlop={8} onPress={() => setQ("")}>
              <Icon.close color={t.fgSubtle} size={18} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {results !== null && results.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: t.fgMuted,
                textAlign: "center",
              }}
            >
              "{query}"와 일치하는 종목이 없습니다.
            </Text>
          </View>
        ) : null}
        {results !== null && results.length > 0 ? (
          <View>
            {results.map((s) => (
              <ResultRow key={s.code} stock={s} t={t} />
            ))}
          </View>
        ) : null}
        {results === null ? (
          <>
            <SectionHead more="전체 삭제" title="최근 검색" />
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                flexWrap: "wrap",
                paddingHorizontal: 16,
                paddingBottom: 8,
              }}
            >
              {recent.map((r) => (
                <View
                  key={r}
                  style={{
                    paddingVertical: 8,
                    paddingLeft: 14,
                    paddingRight: 12,
                    borderRadius: 999,
                    backgroundColor: t.bgSubtle,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: t.fgStrong,
                    }}
                  >
                    {r}
                  </Text>
                  <Icon.close color={t.fgSubtle} size={12} />
                </View>
              ))}
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "baseline",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingTop: 18,
                paddingBottom: 8,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: t.fgStrong }}
              >
                실시간 인기
              </Text>
              <Text style={{ fontSize: 11, color: t.fgSubtle }}>
                오후 3:24 기준
              </Text>
            </View>
            {trendingStocks.map((s, i) => (
              <Pressable
                android_ripple={{ color: t.bgSubtle }}
                key={s.code}
                onPress={() => nav.openStock(s.code)}
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
                <Text
                  style={{
                    width: 24,
                    fontSize: 16,
                    fontWeight: "800",
                    textAlign: "center",
                    color: i < 3 ? t.upStrong : t.fgMuted,
                  }}
                >
                  {i + 1}
                </Text>
                <StockLogo radius={8} size={36} stock={s} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: t.fgStrong,
                    }}
                  >
                    {s.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: t.fgSubtle,
                      fontWeight: "500",
                      marginTop: 2,
                    }}
                  >
                    {s.code} · {s.sector}
                  </Text>
                </View>
                <Text
                  style={{
                    color: t.fgSubtle,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  시세 연결 전
                </Text>
              </Pressable>
            ))}
          </>
        ) : null}
        <View style={{ height: 16 + insets.bottom }} />
      </ScrollView>
    </MrScreen>
  );
}
