import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DiscussionRoomRow } from "@/components/cards";
import { Icon } from "@/components/icons";
import { Chip, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";

type DiscussTab = "hot" | "watch" | "recent";

const TABS: { k: DiscussTab; l: string }[] = [
  { k: "hot", l: "인기" },
  { k: "watch", l: "관심 종목" },
  { k: "recent", l: "최신" },
];

function EmptyState({ title, body }: { title: string; body: string }) {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        paddingVertical: 64,
        paddingHorizontal: 24,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: t.fgStrong,
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: t.fgMuted,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

export default function DiscussScreen() {
  const { t } = useMrTheme();
  const [tab, setTab] = useState<DiscussTab>("hot");
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";
  const isAuthed = Boolean(session?.user);
  const queryClient = useQueryClient();

  const roomsOptions = orpc.discussion.rooms.queryOptions({ input: { tab } });
  const roomsQuery = useQuery(roomsOptions);

  const toggleLike = useMutation(
    orpc.discussion.toggleLike.mutationOptions({
      onSuccess: () => {
        // ADR-0001 #3: no optimistic append — invalidate so server-issued
        // state stays the source of truth (ws migration friendly).
        queryClient.invalidateQueries({ queryKey: roomsOptions.queryKey });
      },
    })
  );

  const handleToggleLike = (roomId: number) => {
    if (!isAuthed) {
      // TODO: open login sheet (consistent with other protected actions).
      return;
    }
    toggleLike.mutate({ roomId });
  };

  const rooms = roomsQuery.data ?? [];

  return (
    <MrScreen>
      <MrHeader title="토론" />
      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => roomsQuery.refetch()}
            refreshing={roomsQuery.isRefetching}
            tintColor={t.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 6,
            paddingVertical: 10,
          }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {TABS.map((c) => (
            <Chip
              active={tab === c.k}
              key={c.k}
              label={c.l}
              onPress={() => setTab(c.k)}
            />
          ))}
        </ScrollView>

        {roomsQuery.isPending ? (
          <View style={{ paddingVertical: 48, alignItems: "center" }}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : null}

        {roomsQuery.isSuccess && rooms.length === 0
          ? renderEmpty(tab, isAuthed)
          : null}

        {rooms.map((r) => (
          <DiscussionRoomRow
            key={r.id}
            onPress={() => nav.openDiscussionRoom(r.id)}
            onToggleLike={() => handleToggleLike(r.id)}
            room={r}
          />
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      {isAdmin ? (
        <Pressable
          onPress={nav.openCreateDiscussionRoom}
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

function renderEmpty(tab: DiscussTab, isAuthed: boolean) {
  if (tab === "watch") {
    if (!isAuthed) {
      return (
        <EmptyState
          body="로그인하면 관심 종목 토론방을 모아 봅니다."
          title="로그인이 필요합니다"
        />
      );
    }
    return (
      <EmptyState
        body="관심 종목을 추가하면 관련 토론방이 여기 모입니다."
        title="관심 종목 토론방이 없습니다"
      />
    );
  }
  return (
    <EmptyState
      body="관리자가 토론방을 열면 이곳에서 바로 참여할 수 있습니다."
      title="아직 토론방이 없습니다"
    />
  );
}
