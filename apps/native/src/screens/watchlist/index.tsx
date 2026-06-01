import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/icons";
import { BackButton, MrHeader, MrScreen } from "@/components/ui";
import { useLiveQuote } from "@/hooks/use-live-quotes";
import { useMrTheme } from "@/hooks/use-mr-theme";
import type { LiveQuote } from "@/stores/quotes-store";
import { changeColor, fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";

interface StockEntry {
  code: string;
  market: string;
  name: string;
}

function Avatar({ name, t }: { name: string; t: MrTokens }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: t.bgSubtle,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "800", color: t.fgMuted }}>
        {name.charAt(0)}
      </Text>
    </View>
  );
}

function MarketBadge({ market, t }: { market: string; t: MrTokens }) {
  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: t.bgSubtle,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: "700", color: t.fgMuted }}>
        {market}
      </Text>
    </View>
  );
}

function EntryRow({
  entry,
  t,
  onPress,
  right,
}: {
  entry: StockEntry;
  t: MrTokens;
  onPress?: () => void;
  right: React.ReactNode;
}) {
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: pressed && onPress ? t.bgSubtle : t.bg,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      })}
    >
      <Avatar name={entry.name} t={t} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}>
          {entry.name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 3,
          }}
        >
          <Text style={{ fontSize: 11, color: t.fgSubtle }}>{entry.code}</Text>
          <MarketBadge market={entry.market} t={t} />
        </View>
      </View>
      {right}
    </Pressable>
  );
}

export default function WatchlistScreen() {
  const { t } = useMrTheme();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const query = q.trim();
  const searching = query.length >= 1;

  const list = useQuery(orpc.watchlist.list.queryOptions());
  const search = useQuery(
    orpc.stock.search.queryOptions({
      input: { query },
      enabled: searching,
    })
  );

  const watched = new Set(list.data?.map((w) => w.code));
  const listKey = orpc.watchlist.list.queryKey();
  // Reconcile with authoritative server state after the mutation settles
  // (success confirms the optimistic change, error rolls it back).
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });
  const addMut = useMutation(
    orpc.watchlist.add.mutationOptions({ onSettled: invalidate })
  );
  const removeMut = useMutation(
    orpc.watchlist.remove.mutationOptions({ onSettled: invalidate })
  );

  type WatchItem = NonNullable<typeof list.data>[number];

  // Optimistic toggle: flip the cached list immediately so the +/check state
  // updates without waiting for the round-trip, with a light haptic tap.
  // Adding also clears the query so the user lands on their updated list.
  const addEntry = (entry: StockEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queryClient.setQueryData<WatchItem[]>(listKey, (old) => {
      const cur = old ?? [];
      if (cur.some((w) => w.code === entry.code)) {
        return cur;
      }
      return [{ ...entry, createdAt: new Date().toISOString() }, ...cur];
    });
    addMut.mutate({ stockCode: entry.code });
    setQ("");
    Keyboard.dismiss();
  };

  const removeEntry = (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queryClient.setQueryData<WatchItem[]>(listKey, (old) =>
      (old ?? []).filter((w) => w.code !== code)
    );
    removeMut.mutate({ stockCode: code });
  };

  // Back exits search first (returns to the list), then leaves the screen.
  const exitSearch = () => {
    setQ("");
    Keyboard.dismiss();
  };
  const handleBack = () => {
    if (searching) {
      exitSearch();
      return;
    }
    nav.back();
  };

  // Android hardware back mirrors the header back while searching.
  useEffect(() => {
    if (!searching) {
      return;
    }
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      exitSearch();
      return true;
    });
    return () => sub.remove();
  }, [searching]);

  const items = list.data ?? [];

  return (
    <MrScreen>
      <MrHeader left={<BackButton onPress={handleBack} />} title="관심 종목" />
      <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 44,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: t.bgSubtle,
          }}
        >
          <Icon.search color={t.fgSubtle} size={18} />
          <TextInput
            autoCapitalize="none"
            onChangeText={setQ}
            placeholder="종목명 또는 코드 검색"
            placeholderTextColor={t.fgSubtle}
            style={{ flex: 1, fontSize: 15, color: t.fgStrong }}
            value={q}
          />
          {q ? (
            <Pressable hitSlop={8} onPress={() => setQ("")}>
              <Icon.close color={t.fgSubtle} size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {searching ? (
          <SearchResults
            isLoading={search.isLoading}
            onAdd={addEntry}
            onRemove={removeEntry}
            results={search.data}
            t={t}
            watched={watched}
          />
        ) : (
          <MyList
            isLoading={list.isLoading}
            items={items}
            onRemove={removeEntry}
            t={t}
          />
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </MrScreen>
  );
}

function SearchResults({
  results,
  isLoading,
  watched,
  onAdd,
  onRemove,
  t,
}: {
  results: StockEntry[] | undefined;
  isLoading: boolean;
  watched: Set<string>;
  onAdd: (entry: StockEntry) => void;
  onRemove: (code: string) => void;
  t: MrTokens;
}) {
  if (isLoading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (!results || results.length === 0) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <Text style={{ fontSize: 13, color: t.fgSubtle }}>
          검색 결과가 없어요.
        </Text>
      </View>
    );
  }
  return (
    <View>
      {results.map((s) => {
        const isWatched = watched.has(s.code);
        return (
          <EntryRow
            entry={s}
            key={s.code}
            right={
              <Pressable
                hitSlop={8}
                onPress={() => (isWatched ? onRemove(s.code) : onAdd(s))}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isWatched ? t.primary : t.bgSubtle,
                }}
              >
                {isWatched ? (
                  <Icon.check color={t.primaryOn} size={18} />
                ) : (
                  <Icon.plus color={t.fgStrong} size={18} />
                )}
              </Pressable>
            }
            t={t}
          />
        );
      })}
    </View>
  );
}

function PriceBlock({ quote, t }: { quote: LiveQuote; t: MrTokens }) {
  return (
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
  );
}

// Row-level subscription: 각 행은 자기 종목 코드로 store에 직접 register하므로
// 한 종목 틱이 다른 행을 리렌더하지 않는다.
function MyListRow({
  entry,
  onRemove,
  t,
}: {
  entry: StockEntry;
  onRemove: (code: string) => void;
  t: MrTokens;
}) {
  const quote = useLiveQuote(entry.code);
  return (
    <EntryRow
      entry={entry}
      onPress={() => nav.openStock(entry.code)}
      right={
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          {quote ? <PriceBlock quote={quote} t={t} /> : null}
          <Pressable
            hitSlop={8}
            onPress={() => onRemove(entry.code)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.bgSubtle,
            }}
          >
            <Icon.close color={t.fgMuted} size={16} />
          </Pressable>
        </View>
      }
      t={t}
    />
  );
}

function MyList({
  items,
  isLoading,
  onRemove,
  t,
}: {
  items: StockEntry[];
  isLoading: boolean;
  onRemove: (code: string) => void;
  t: MrTokens;
}) {
  if (isLoading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }
  if (items.length === 0) {
    return (
      <View style={{ paddingVertical: 56, alignItems: "center", gap: 10 }}>
        <Icon.navWatch color={t.fgSubtle} size={32} />
        <Text style={{ fontSize: 13, color: t.fgSubtle, textAlign: "center" }}>
          관심 종목이 없어요.{"\n"}위에서 종목을 검색해 추가하세요.
        </Text>
      </View>
    );
  }
  return (
    <View>
      {items.map((s) => (
        <MyListRow entry={s} key={s.code} onRemove={onRemove} t={t} />
      ))}
    </View>
  );
}
