import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconProps } from "@/components/icons";
import { BackButton, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";

const PAGE_SIZE = 20;
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

type NotifType =
  | "buy_signal"
  | "sell_signal"
  | "price_alert"
  | "breaking_news"
  | "market_summary";

interface HistoryItem {
  body: string;
  createdAt: string;
  id: string;
  read: boolean;
  title: string;
  type: NotifType;
}

interface TypeMeta {
  bg: string;
  color: string;
  icon: (p: IconProps) => React.JSX.Element;
}

function typeMetaFor(type: NotifType, t: MrTokens): TypeMeta {
  switch (type) {
    case "buy_signal":
      return { color: t.upStrong, bg: t.upBg, icon: Icon.arrowUp };
    case "sell_signal":
      return { color: t.downStrong, bg: t.downBg, icon: Icon.arrowDown };
    case "price_alert":
      return { color: t.primary, bg: t.primarySubtle, icon: Icon.trending };
    case "market_summary":
      return { color: t.sigAi, bg: t.sigAiBg, icon: Icon.sparkles };
    default:
      return { color: t.sigEvent, bg: t.warningBg, icon: Icon.navNews };
  }
}

function sectionOf(iso: string): string {
  const ts = new Date(iso).getTime();
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  if (ts >= startOfToday) {
    return "오늘";
  }
  if (ts >= startOfToday - DAY) {
    return "어제";
  }
  if (ts >= startOfToday - 7 * DAY) {
    return "지난 7일";
  }
  return "이전";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < MIN) {
    return "방금";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MIN)}분 전`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)}시간 전`;
  }
  return `${Math.floor(diff / DAY)}일 전`;
}

// Flat list rows: an item plus the section title to render above it (or null
// when it shares the section of the previous item).
interface Row {
  header: string | null;
  item: HistoryItem;
}

function toRows(items: HistoryItem[]): Row[] {
  let prev: string | null = null;
  return items.map((item) => {
    const section = sectionOf(item.createdAt);
    const header = section === prev ? null : section;
    prev = section;
    return { header, item };
  });
}

function SectionHeader({ title, t }: { title: string; t: MrTokens }) {
  return (
    <Text
      style={{
        backgroundColor: t.bgSubtle,
        color: t.fgMuted,
        fontSize: 12,
        fontWeight: "700",
        paddingBottom: 4,
        paddingHorizontal: 16,
        paddingTop: 14,
      }}
    >
      {title}
    </Text>
  );
}

function NotifRow({
  item,
  onPress,
  t,
}: {
  item: HistoryItem;
  onPress: () => void;
  t: MrTokens;
}) {
  const m = typeMetaFor(item.type, t);
  const RowIcon = m.icon;
  return (
    <Pressable
      android_ripple={{ color: t.bgSubtle }}
      onPress={onPress}
      style={({ pressed }) => ({
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
          backgroundColor: m.bg,
          borderRadius: 10,
          height: 36,
          justifyContent: "center",
          width: 36,
        }}
      >
        <RowIcon color={m.color} size={18} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <Text style={{ color: t.fgStrong, fontSize: 14, fontWeight: "700" }}>
          {item.title}
        </Text>
        <Text
          style={{
            color: t.fgMuted,
            fontSize: 13,
            lineHeight: 19,
            marginTop: 2,
          }}
        >
          {item.body}
        </Text>
        <Text style={{ color: t.fgSubtle, fontSize: 11, marginTop: 6 }}>
          {relativeTime(item.createdAt)}
        </Text>
      </View>
      {item.read ? null : (
        <View
          style={{
            backgroundColor: t.primary,
            borderRadius: 999,
            height: 6,
            position: "absolute",
            right: 16,
            top: 20,
            width: 6,
          }}
        />
      )}
    </Pressable>
  );
}

export default function AlertsScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const feed = useInfiniteQuery(
    orpc.notification.history.infiniteOptions({
      input: (cursor: string | undefined) => ({ cursor, limit: PAGE_SIZE }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    })
  );
  const items = (feed.data?.pages.flatMap((p) => p.items) ??
    []) as HistoryItem[];
  const rows = toRows(items);
  const hasUnread = items.some((n) => !n.read);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: orpc.notification.history.key(),
    });
    queryClient.invalidateQueries({
      queryKey: orpc.notification.unreadCount.queryKey(),
    });
  };
  const markRead = useMutation(
    orpc.notification.markRead.mutationOptions({ onSuccess: invalidate })
  );
  const markAllRead = useMutation(
    orpc.notification.markAllRead.mutationOptions({ onSuccess: invalidate })
  );

  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  };

  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
        right={
          hasUnread ? (
            <Pressable
              hitSlop={6}
              onPress={() => markAllRead.mutate({})}
              style={{ justifyContent: "center", paddingHorizontal: 8 }}
            >
              <Text
                style={{ color: t.primary, fontSize: 13, fontWeight: "700" }}
              >
                모두 읽음
              </Text>
            </Pressable>
          ) : null
        }
        title="알림함"
      />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.item.id}
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : (
            <View
              style={{ alignItems: "center", gap: 10, paddingVertical: 56 }}
            >
              <Icon.bell color={t.fgSubtle} size={32} />
              <Text style={{ color: t.fgSubtle, fontSize: 13 }}>
                아직 받은 알림이 없어요.
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
            <View style={{ height: 16 + insets.bottom }} />
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item: row }) => (
          <>
            {row.header ? <SectionHeader t={t} title={row.header} /> : null}
            <NotifRow
              item={row.item}
              onPress={() => {
                if (!row.item.read) {
                  markRead.mutate({ id: row.item.id });
                }
              }}
              t={t}
            />
          </>
        )}
        showsVerticalScrollIndicator={false}
      />
    </MrScreen>
  );
}
