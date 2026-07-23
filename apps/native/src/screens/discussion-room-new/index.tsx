import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
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
import type { MrTokens } from "@/utils/theme";

type Sentiment = "up" | "neutral" | "down";

const SENTIMENT_OPTIONS: { value: Sentiment; label: string }[] = [
  { value: "up", label: "긍정" },
  { value: "neutral", label: "중립" },
  { value: "down", label: "부정" },
];

const NAME_MAX = 50;
const DESCRIPTION_MAX = 200;

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

export default function CreateDiscussionRoomScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment>("neutral");
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

  const createRoom = useMutation(
    orpc.discussion.createRoom.mutationOptions({
      onSuccess: ({ id }) => {
        // ADR-0001 #3: invalidate so the new room appears via authoritative refetch.
        queryClient.invalidateQueries({
          queryKey: orpc.discussion.rooms.key(),
        });
        router.replace(`/(moneyroad)/discussion-room/${id}` as Href);
      },
    })
  );

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !createRoom.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    createRoom.mutate({
      name: trimmedName,
      description: description.trim(),
      stockCode: selectedStock?.code ?? null,
      sentiment,
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
          새 토론방
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Name */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            이름 *
          </Text>
          <TextInput
            maxLength={NAME_MAX}
            onChangeText={setName}
            placeholder="예: 삼성전자 매수 토론"
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
            value={name}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {name.length}/{NAME_MAX}
          </Text>
        </View>

        {/* Description */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            설명
          </Text>
          <TextInput
            maxLength={DESCRIPTION_MAX}
            multiline
            numberOfLines={3}
            onChangeText={setDescription}
            placeholder="이 토론방에서 다룰 주제를 안내해 주세요."
            placeholderTextColor={t.fgSubtle}
            style={{
              marginTop: 8,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: t.fgStrong,
              minHeight: 80,
              textAlignVertical: "top",
            }}
            value={description}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {description.length}/{DESCRIPTION_MAX}
          </Text>
        </View>

        {/* Stock binding (optional) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            종목 결합 (선택)
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
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: t.primary,
                  }}
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
              <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 6 }}>
                비워두면 종목 결합 없이 일반 토론방으로 개설됩니다.
              </Text>

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

        {/* Sentiment */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            톤
          </Text>
          <View style={{ marginTop: 8 }}>
            <SegmentedControl
              onChange={setSentiment}
              options={SENTIMENT_OPTIONS}
              value={sentiment}
            />
          </View>
          <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 6 }}>
            긍정/부정 톤은 토론방 행 우측에 라벨로 표시됩니다. 나중에 변경할 수
            있습니다.
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
            {createRoom.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                토론방 만들기
              </Text>
            )}
          </Pressable>
          {createRoom.isError ? (
            <Text
              style={{
                marginTop: 10,
                fontSize: 12,
                color: t.downStrong,
                textAlign: "center",
              }}
            >
              생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </MrScreen>
  );
}
