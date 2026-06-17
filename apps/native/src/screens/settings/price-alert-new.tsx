import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/icons";
import { SegmentedControl } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { SettingsGroup, SettingsScreen } from "@/screens/settings/ui";
import { fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";

type Direction = "above" | "below";
type StockPick = { code: string; name: string; market: string };

const DIRECTION_OPTIONS: { value: Direction; label: string }[] = [
  { value: "above", label: "이상" },
  { value: "below", label: "이하" },
];

function digitsOnly(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

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
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: pressed ? t.bgSubtle : "transparent",
                borderTopWidth: 1,
                borderTopColor: t.border,
              })}
            >
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}
              >
                {r.name}
              </Text>
              <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 2 }}>
                {r.code} · {r.market}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

function PriceInput({
  priceInput,
  setPriceInput,
}: {
  priceInput: string;
  setPriceInput: (v: string) => void;
}) {
  const { t } = useMrTheme();
  return (
    <View style={{ ...INPUT_ROW, backgroundColor: t.bgSubtle }}>
      <TextInput
        keyboardType="number-pad"
        onChangeText={setPriceInput}
        placeholder="도달가 입력"
        placeholderTextColor={t.fgSubtle}
        style={{
          flex: 1,
          fontSize: 16,
          fontWeight: "700",
          color: t.fgStrong,
          padding: 0,
        }}
        value={priceInput}
      />
      <Text style={{ fontSize: 14, color: t.fgMuted, fontWeight: "700" }}>
        원
      </Text>
    </View>
  );
}

function computeDirectTarget(priceInput: string): number | null {
  const value = digitsOnly(priceInput);
  return value > 0 ? value : null;
}

function AlertForm({ stock }: { stock: StockPick }) {
  const { t } = useMrTheme();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState<Direction>("above");
  const [priceInput, setPriceInput] = useState("");

  const createAlert = useMutation(
    orpc.priceAlert.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.priceAlert.list.key() });
        nav.back();
      },
    })
  );

  const targetPrice = computeDirectTarget(priceInput);
  const canSubmit = targetPrice !== null && !createAlert.isPending;

  return (
    <>
      <SettingsGroup label="알림 방향">
        <View style={{ paddingHorizontal: 16 }}>
          <SegmentedControl
            onChange={setDirection}
            options={DIRECTION_OPTIONS}
            value={direction}
          />
          <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 6 }}>
            {direction === "above"
              ? "도달가 이상이 되면 알림을 받습니다."
              : "도달가 이하가 되면 알림을 받습니다."}
          </Text>
        </View>
      </SettingsGroup>

      <SettingsGroup label="가격 설정">
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 11, color: t.fgSubtle }}>
            현재가 데이터가 연결되기 전까지 도달가는 직접 입력만 사용할 수
            있어요.
          </Text>

          <PriceInput priceInput={priceInput} setPriceInput={setPriceInput} />

          <View
            style={{
              marginTop: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, color: t.fgMuted }}>도달가</Text>
            <Text
              style={{ fontSize: 15, fontWeight: "800", color: t.fgStrong }}
            >
              {targetPrice === null ? "-" : `${fmt.price(targetPrice)}원`}
            </Text>
          </View>
        </View>
      </SettingsGroup>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <Pressable
          disabled={!canSubmit}
          onPress={() =>
            targetPrice !== null &&
            createAlert.mutate({
              stockCode: stock.code,
              direction,
              targetPrice,
            })
          }
          style={{
            height: 48,
            borderRadius: 12,
            backgroundColor: canSubmit ? t.primary : t.borderStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {createAlert.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
              알림 추가
            </Text>
          )}
        </Pressable>
        {createAlert.isError ? (
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              color: t.downStrong,
              textAlign: "center",
            }}
          >
            추가 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.
          </Text>
        ) : null}
      </View>
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
        <AlertForm key={selectedStock.code} stock={selectedStock} />
      ) : null}
      <View style={{ height: 24 }} />
    </SettingsScreen>
  );
}
