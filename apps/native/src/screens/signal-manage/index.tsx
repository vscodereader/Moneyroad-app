import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

import { Icon } from "@/components/icons";
import { BackButton, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import type { Signal } from "@/utils/data";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import { type MrTokens, signalActionMeta } from "@/utils/theme";

const PAGE_SIZE = 30;

type FeedPage = { items: Signal[]; nextCursor: string | null };

function SignalRow({
  signal,
  onRemove,
  t,
}: {
  signal: Signal;
  onRemove: (id: string) => void;
  t: MrTokens;
}) {
  const meta = signalActionMeta(t)[signal.action];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
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
          <Text style={{ fontSize: 11, color: t.fgSubtle, marginLeft: "auto" }}>
            {signal.time}
          </Text>
        </View>
        <Text
          numberOfLines={2}
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
      </View>
      <Pressable
        hitSlop={8}
        onPress={() => onRemove(signal.id)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.bgSubtle,
        }}
      >
        <Icon.trash color={t.downStrong} size={18} />
      </Pressable>
    </View>
  );
}

export default function ManageSignalsScreen() {
  const { t } = useMrTheme();
  const queryClient = useQueryClient();

  const feedOptions = orpc.signal.feed.infiniteOptions({
    input: (cursor: string | undefined) => ({
      window: "all" as const,
      cursor,
      limit: PAGE_SIZE,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const feed = useInfiniteQuery(feedOptions);
  const items = (feed.data?.pages.flatMap((p) => p.items) ?? []) as Signal[];

  const removeMut = useMutation(
    orpc.signal.remove.mutationOptions({
      // Reconcile every signal feed (tab/home/stock detail) + counts with the
      // server once the delete settles.
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: orpc.signal.feed.key() });
        queryClient.invalidateQueries({ queryKey: orpc.signal.counts.key() });
      },
    })
  );

  // Optimistic delete: drop the signal from the cached pages immediately, then
  // fire the request (watchlist removal pattern).
  const removeSignal = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    queryClient.setQueryData<InfiniteData<FeedPage, string | undefined>>(
      feedOptions.queryKey,
      (old) =>
        old && {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.filter((s) => s.id !== id),
          })),
        }
    );
    removeMut.mutate({ id });
  };

  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  };

  return (
    <MrScreen>
      <MrHeader left={<BackButton onPress={nav.back} />} title="시그널 관리" />
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
                등록된 시그널이 없어요.
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
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => (
          <SignalRow onRemove={removeSignal} signal={item} t={t} />
        )}
        showsVerticalScrollIndicator={false}
      />
    </MrScreen>
  );
}
