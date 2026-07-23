import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/icons";
import { PriceAlertControls } from "@/components/price-alert-controls";
import { StockResourceLogo } from "@/components/ui";
import { useLiveQuote } from "@/hooks/use-live-quotes";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { SettingsGroup, SettingsScreen } from "@/screens/settings/ui";
import { fmt } from "@/utils/format";
import { orpc } from "@/utils/orpc";

type StockPick = {
  code: string;
  name: string;
  market: string;
  iconUrl?: null | string;
};

const INPUT_ROW = {
  marginTop: 10,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  paddingHorizontal: 14,
  height: 48,
  borderRadius: 10,
};

function StockPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: StockPick | null;
  onSelect: (s: StockPick) => void;
  onClear: () => void;
}) {
  const { t } = useMrTheme();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(handle);
  }, [query]);

  const search = useQuery({
    ...orpc.stock.search.queryOptions({
      input: { query: debounced.trim(), limit: 10 },
    }),
    enabled: debounced.trim().length >= 1 && !selected,
  });

  if (selected) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: t.primarySubtle,
          borderRadius: 10,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: t.primary }}>
            {selected.name}
          </Text>
          <Text style={{ fontSize: 11, color: t.fgMuted, marginTop: 2 }}>
            {selected.code} · {selected.market}
          </Text>
        </View>
        <Pressable hitSlop={8} onPress={onClear}>
          <Icon.close color={t.fgMuted} size={18} />
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <View style={{ ...INPUT_ROW, marginTop: 0, backgroundColor: t.bgSubtle }}>
        <Icon.search color={t.fgSubtle} size={16} />
        <TextInput
          onChangeText={setQuery}
          placeholder="종목명 · 종목코드로 검색"
          placeholderTextColor={t.fgSubtle}
          style={{ flex: 1, fontSize: 14, color: t.fgStrong, padding: 0 }}
          value={query}
        />
        {query ? (
          <Pressable hitSlop={8} onPress={() => setQuery("")}>
            <Icon.close color={t.fgSubtle} size={14} />
          </Pressable>
        ) : null}
      </View>

      {search.isFetching ? (
        <View style={{ paddingVertical: 16, alignItems: "center" }}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : null}

      {search.data && search.data.length > 0 ? (
        <View
          style={{
            marginTop: 8,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: t.bg,
            borderWidth: 1,
            borderColor: t.border,
          }}
        >
          {search.data.map((r) => (
            <Pressable
              android_ripple={{ color: t.bgSubtle }}
              key={r.code}
              onPress={() => {
                onSelect(r);
                setQuery("");
              }}
              style={({ pressed }) => ({
                // ----(변경: 아이콘 표시 위해 가로 배치)----
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                // ----(변경 끝)----
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: pressed ? t.bgSubtle : "transparent",
                borderTopWidth: 1,
                borderTopColor: t.border,
              })}
            >
              {/* ----(추가: 종목 아이콘)---- */}
              <StockResourceLogo iconUrl={r.iconUrl} name={r.name} />
              {/* ----(추가 끝)---- */}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}
                >
                  {r.name}
                </Text>
                <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 2 }}>
                  {r.code} · {r.market}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

// 종목 선택 후 현재가 기준 가격 알림 설정(stock/[code] 시트와 동일한 UI).
function AlertEditor({ stock }: { stock: StockPick }) {
  const { t } = useMrTheme();
  const live = useLiveQuote(stock.code);
  return (
    <>
      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <Text
          style={{
            color: t.fgStrong,
            fontSize: 20,
            fontWeight: "800",
            letterSpacing: -0.3,
          }}
        >
          가격 알림을 받을까요?
        </Text>
        <Text
          style={{
            color: t.fgMuted,
            fontSize: 14,
            fontWeight: "600",
            marginTop: 6,
          }}
        >
          {stock.name} ·{" "}
          {live ? `현재가 ${fmt.price(live.price)}원` : "시세 연결 중"}
        </Text>
      </View>
      <PriceAlertControls currentPrice={live?.price} stockCode={stock.code} />
    </>
  );
}

export default function PriceAlertNewScreen() {
  const [selectedStock, setSelectedStock] = useState<StockPick | null>(null);

  return (
    <SettingsScreen title="가격 알림 추가">
      <SettingsGroup label="종목">
        <View style={{ paddingHorizontal: 16 }}>
          <StockPicker
            onClear={() => setSelectedStock(null)}
            onSelect={setSelectedStock}
            selected={selectedStock}
          />
        </View>
      </SettingsGroup>

      {selectedStock ? (
        <AlertEditor key={selectedStock.code} stock={selectedStock} />
      ) : null}
      <View style={{ height: 32 }} />
    </SettingsScreen>
  );
}
