import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import {
  BackButton,
  MrScreen,
  SegmentedControl,
  StockResourceLogo,
} from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens, SignalAction } from "@/utils/theme";

const ACTION_OPTIONS: { value: SignalAction; label: string }[] = [
  { value: "buy", label: "매수" },
  { value: "sell", label: "매도" },
  { value: "hold", label: "관망" },
];

const STRENGTH_OPTIONS = ["1", "2", "3", "4", "5"].map((v) => ({
  value: v,
  label: v,
}));

const TITLE_MAX = 80;
const BODY_MAX = 500;

type StockPick = {
  code: string;
  name: string;
  market: string;
  iconUrl?: null | string;
};

function StockResultRow({
  result,
  onSelect,
  t,
}: {
  result: StockPick;
  onSelect: (r: StockPick) => void;
  t: MrTokens;
}) {
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      onPress={() => onSelect(result)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: pressed ? t.bgSubtle : "transparent",
        borderTopWidth: 1,
        borderTopColor: t.border,
      })}
    >
      {/* ----(추가: 종목 아이콘)---- */}
      <StockResourceLogo iconUrl={result.iconUrl} name={result.name} />
      {/* ----(추가 끝)---- */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}>
          {result.name}
        </Text>
        <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 2 }}>
          {result.code} · {result.market}
        </Text>
      </View>
    </Pressable>
  );
}

export default function CreateSignalScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<SignalAction>("buy");
  const [strength, setStrength] = useState("3");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockPick | null>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [debouncedStockQuery, setDebouncedStockQuery] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedStockQuery(stockQuery), 220);
    return () => clearTimeout(handle);
  }, [stockQuery]);

  const stockSearch = useQuery({
    ...orpc.stock.search.queryOptions({
      input: { query: debouncedStockQuery.trim(), limit: 10 },
    }),
    enabled: debouncedStockQuery.trim().length >= 1 && !selectedStock,
  });

  const createSignal = useMutation(
    orpc.signal.create.mutationOptions({
      onSuccess: () => {
        // ADR-0001 #3: invalidate so the new signal appears via authoritative refetch.
        queryClient.invalidateQueries({ queryKey: orpc.signal.feed.key() });
        queryClient.invalidateQueries({ queryKey: orpc.signal.counts.key() });
        router.replace("/(moneyroad)/(tabs)/signals" as Href);
      },
    })
  );

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const canSubmit =
    Boolean(selectedStock) &&
    trimmedTitle.length > 0 &&
    trimmedBody.length > 0 &&
    !createSignal.isPending;

  const handleSubmit = () => {
    if (!(canSubmit && selectedStock)) {
      return;
    }
    createSignal.mutate({
      stockCode: selectedStock.code,
      action,
      strength: Number(strength),
      title: trimmedTitle,
      body: trimmedBody,
    });
  };

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
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: "800",
            color: t.fgStrong,
          }}
        >
          새 시그널
        </Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Stock binding (required) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            종목 *
          </Text>
          {selectedStock ? (
            <View
              style={{
                marginTop: 8,
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
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: t.primary }}
                >
                  {selectedStock.name}
                </Text>
                <Text style={{ fontSize: 11, color: t.fgMuted, marginTop: 2 }}>
                  {selectedStock.code} · {selectedStock.market}
                </Text>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setSelectedStock(null);
                  setStockQuery("");
                }}
              >
                <Icon.close color={t.fgMuted} size={18} />
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: t.bgSubtle,
                }}
              >
                <Icon.search color={t.fgSubtle} size={16} />
                <TextInput
                  onChangeText={setStockQuery}
                  placeholder="종목명 · 종목코드로 검색"
                  placeholderTextColor={t.fgSubtle}
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: t.fgStrong,
                    padding: 0,
                  }}
                  value={stockQuery}
                />
                {stockQuery ? (
                  <Pressable hitSlop={8} onPress={() => setStockQuery("")}>
                    <Icon.close color={t.fgSubtle} size={14} />
                  </Pressable>
                ) : null}
              </View>

              {stockSearch.isFetching ? (
                <View style={{ paddingVertical: 16, alignItems: "center" }}>
                  <ActivityIndicator color={t.primary} />
                </View>
              ) : null}

              {stockSearch.data && stockSearch.data.length > 0 ? (
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
                  {stockSearch.data.map((r) => (
                    <StockResultRow
                      key={r.code}
                      onSelect={(picked) => {
                        setSelectedStock(picked);
                        setStockQuery("");
                      }}
                      result={r}
                      t={t}
                    />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Action */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            액션
          </Text>
          <View style={{ marginTop: 8 }}>
            <SegmentedControl
              onChange={setAction}
              options={ACTION_OPTIONS}
              value={action}
            />
          </View>
        </View>

        {/* Strength */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            강도
          </Text>
          <View style={{ marginTop: 8 }}>
            <SegmentedControl
              onChange={setStrength}
              options={STRENGTH_OPTIONS}
              value={strength}
            />
          </View>
          <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 6 }}>
            1(약함) ~ 5(강함). 카드의 강도 바로 표시됩니다.
          </Text>
        </View>

        {/* Title */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            제목 *
          </Text>
          <TextInput
            maxLength={TITLE_MAX}
            onChangeText={setTitle}
            placeholder="예: 거래량 급증 + 골든크로스 임박"
            placeholderTextColor={t.fgSubtle}
            style={{
              marginTop: 8,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: t.fgStrong,
              fontWeight: "600",
            }}
            value={title}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {title.length}/{TITLE_MAX}
          </Text>
        </View>

        {/* Body */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            내용 *
          </Text>
          <TextInput
            maxLength={BODY_MAX}
            multiline
            numberOfLines={4}
            onChangeText={setBody}
            placeholder="시그널 근거와 해석을 적어주세요."
            placeholderTextColor={t.fgSubtle}
            style={{
              marginTop: 8,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: t.fgStrong,
              minHeight: 110,
              textAlignVertical: "top",
            }}
            value={body}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {body.length}/{BODY_MAX}
          </Text>
        </View>

        {/* Submit */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Pressable
            disabled={!canSubmit}
            onPress={handleSubmit}
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: canSubmit ? t.primary : t.borderStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {createSignal.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                시그널 등록
              </Text>
            )}
          </Pressable>
          {createSignal.isError ? (
            <Text
              style={{
                marginTop: 10,
                fontSize: 12,
                color: t.downStrong,
                textAlign: "center",
              }}
            >
              등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </MrScreen>
  );
}
