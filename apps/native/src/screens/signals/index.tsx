import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { SignalCard } from "@/components/cards";
import { Icon } from "@/components/icons";
//import { Chip, IconButton, MrHeader, MrScreen } from "@/components/ui";
import { Chip, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";
import type { Signal } from "@/utils/data";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import { SIGNAL_ACTION_KEYS, type SignalAction } from "@/utils/theme";

type FilterKey = "all" | SignalAction;

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "전체",
  buy: "매수",
  sell: "매도",
  hold: "관망",
};

const FILTER_KEYS: FilterKey[] = ["all", ...SIGNAL_ACTION_KEYS];
const PAGE_SIZE = 20;

export default function SignalsScreen() {
  const { t } = useMrTheme();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";

  const counts = useQuery(
    orpc.signal.counts.queryOptions({ input: { window: "24h" } })
  );
  const feed = useInfiniteQuery(
    orpc.signal.feed.infiniteOptions({
      input: (cursor: string | undefined) => ({
        action: filter === "all" ? undefined : filter,
        window: "24h" as const,
        cursor,
        limit: PAGE_SIZE,
      }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    })
  );
  const items = (feed.data?.pages.flatMap((p) => p.items) ?? []) as Signal[];
  const countOf = (k: FilterKey) => counts.data?.[k] ?? 0;

  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  };

  return (
    <MrScreen>
      <MrHeader
        // right={
        //   <IconButton>
        //     <Icon.sliders color={t.fgStrong} size={22} />
        //   </IconButton>
        // }
        title="시그널"
      />
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : (
            <View
              style={{ alignItems: "center", gap: 10, paddingVertical: 56 }}
            >
              <Icon.navSignal color={t.fgSubtle} size={32} />
              <Text
                style={{ color: t.fgSubtle, fontSize: 13, textAlign: "center" }}
              >
                {filter === "all"
                  ? "최근 24시간 시그널이 아직 없어요."
                  : `${FILTER_LABELS[filter]} 시그널이 아직 없어요.`}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <ActivityIndicator color={t.primary} size="small" />
            </View>
          ) : (
            <View style={{ height: 16 }} />
          )
        }
        ListHeaderComponent={
          <View>
            <View
              style={{
                paddingBottom: 4,
                paddingHorizontal: 16,
                paddingTop: 12,
              }}
            >
              <Text
                style={{
                  color: t.fgMuted,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.3,
                }}
              >
                최근 24시간
              </Text>
              <View
                style={{
                  alignItems: "baseline",
                  flexDirection: "row",
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <Text
                  style={{
                    color: t.fgStrong,
                    fontSize: 26,
                    fontWeight: "800",
                    letterSpacing: -0.5,
                  }}
                >
                  {countOf("all")}
                </Text>
                <Text
                  style={{ color: t.fgMuted, fontSize: 13, fontWeight: "700" }}
                >
                  건의 시그널
                </Text>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={{
                gap: 6,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {FILTER_KEYS.map((k) => (
                <Chip
                  active={filter === k}
                  count={countOf(k)}
                  key={k}
                  label={FILTER_LABELS[k]}
                  onPress={() => setFilter(k)}
                />
              ))}
            </ScrollView>
          </View>
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <SignalCard
            expanded={openId === item.id}
            onStockPress={() => nav.openStock(item.code)}
            onToggle={() => setOpenId(openId === item.id ? null : item.id)}
            signal={item}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      {isAdmin ? (
        <Pressable
          onPress={nav.openCreateSignal}
          style={{
            position: "absolute",
            right: 16,
            bottom: 24,
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: t.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: t.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Icon.plus color="#fff" size={24} />
        </Pressable>
      ) : null}
    </MrScreen>
  );
}
