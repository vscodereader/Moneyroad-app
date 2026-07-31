import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  DiscussionRoomRow,
  DiscussionRoomRowSkeleton,
} from "@/components/cards";
import { Icon } from "@/components/icons";
import { Chip, IconButton, MrHeader, MrScreen } from "@/components/ui";
import { useDiscussionListStream } from "@/hooks/use-discussion-list-stream";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { useProtectedAction } from "@/hooks/use-protected-action";
import { authClient } from "@/lib/auth-client";
import type { MoneyRoadReturnTo } from "@/utils/auth-navigation";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";

export type DiscussTab = "hot" | "watch" | "recent" | "favorite";

const TABS: { k: DiscussTab; l: string }[] = [
  { k: "hot", l: "인기" },
  { k: "watch", l: "관심 종목" },
  { k: "recent", l: "최신" },
  { k: "favorite", l: "즐겨찾기" },
];

const ROOM_SKELETON_KEYS = ["s1", "s2", "s3", "s4"] as const;

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

function discussionReturnTo(
  tab: DiscussTab,
  searchOpen = false
): MoneyRoadReturnTo {
  const params = new URLSearchParams({ tab });
  if (searchOpen) {
    params.set("search", "1");
  }
  return `/(moneyroad)/(tabs)/discuss?${params.toString()}` as MoneyRoadReturnTo;
}

export default function DiscussScreen({
  initialSearchOpen = false,
  initialTab,
}: {
  initialSearchOpen?: boolean;
  initialTab?: DiscussTab;
}) {
  const { t } = useMrTheme();
  const [tab, setTab] = useState<DiscussTab>(initialTab ?? "hot");
  // 검색: 아이콘으로 입력창 토글, 제출(엔터) 시에만 query에 반영해 rooms 쿼리로 넘긴다.
  // q가 있으면 백엔드가 탭을 무시하고 이름/종목명 부분일치로 검색한다.
  const [searchOpen, setSearchOpen] = useState(initialSearchOpen);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  // 당겨서 새로고침 스피너는 "사용자가 당길 때"만. 5초 백그라운드 폴링엔 안 뜨게.
  const [refreshing, setRefreshing] = useState(false);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";
  const isAuthed = Boolean(session?.user);
  const { runProtected } = useProtectedAction();
  const queryClient = useQueryClient();
  const defaultSeeded = useRef(Boolean(initialTab));

  useEffect(() => {
    if (defaultSeeded.current || sessionPending) {
      return;
    }
    if (isAuthed) {
      setTab("watch");
    }
    defaultSeeded.current = true;
  }, [isAuthed, sessionPending]);

  // RFC 0004: 목록 폴링을 SSE 구독으로 교체. 이벤트 수신 시 rooms 쿼리를 무효화한다.
  useDiscussionListStream();

  const trimmedQuery = query.trim();
  const roomsOptions = orpc.discussion.rooms.queryOptions({
    input: { tab, q: trimmedQuery ? trimmedQuery : undefined },
  });
  const protectedSelection =
    tab === "watch" || tab === "favorite" || trimmedQuery.length > 0;
  const roomsQuery = useQuery({
    ...roomsOptions,
    enabled: !sessionPending && (isAuthed || !protectedSelection),
  });

  const toggleLike = useMutation(
    orpc.discussion.toggleLike.mutationOptions({
      onSuccess: () => {
        // ADR-0001 #3: no optimistic append — invalidate so server-issued
        // state stays the source of truth (ws migration friendly).
        queryClient.invalidateQueries({ queryKey: roomsOptions.queryKey });
      },
    })
  );

  // RFC 0003 D3: 관리자 토론방 삭제(하드 삭제 + FK cascade). 확인창 없이 바로 삭제.
  const deleteRoom = useMutation(
    orpc.discussion.deleteRoom.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: roomsOptions.queryKey });
      },
    })
  );

  const toggleFavorite = useMutation(
    orpc.discussion.toggleFavorite.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: roomsOptions.queryKey });
      },
    })
  );

  const handleToggleLike = (roomId: number) => {
    runProtected({
      returnTo: discussionReturnTo(tab, searchOpen),
      action: () => toggleLike.mutate({ roomId }),
    });
  };

  const handleToggleFavorite = (roomId: number) => {
    runProtected({
      returnTo: discussionReturnTo(tab, searchOpen),
      action: () => toggleFavorite.mutate({ roomId }),
    });
  };

  const toggleSearch = () => {
    runProtected({
      returnTo: discussionReturnTo(tab, true),
      action: () => {
        if (searchOpen) {
          // 닫을 때 검색을 초기화해 탭 결과로 되돌린다.
          setSearchInput("");
          setQuery("");
        }
        setSearchOpen(!searchOpen);
      },
    });
  };

  const selectTab = (nextTab: DiscussTab) => {
    if (nextTab === "watch" || nextTab === "favorite") {
      runProtected({
        returnTo: discussionReturnTo(nextTab),
        action: () => setTab(nextTab),
      });
      return;
    }
    setTab(nextTab);
  };

  const clearSearch = () => {
    setSearchInput("");
    setQuery("");
  };

  const rooms = roomsQuery.data ?? [];

  return (
    <MrScreen>
      <MrHeader title="토론" />
      <ScrollView
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              setRefreshing(true);
              roomsQuery.refetch().finally(() => setRefreshing(false));
            }}
            refreshing={refreshing}
            tintColor={t.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingRight: 8,
          }}
        >
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 6,
              paddingVertical: 10,
            }}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
          >
            {TABS.map((c) => (
              <Chip
                active={tab === c.k}
                key={c.k}
                label={c.l}
                onPress={() => selectTab(c.k)}
              />
            ))}
          </ScrollView>
          <IconButton onPress={toggleSearch}>
            <Icon.search color={searchOpen ? t.primary : t.fgMuted} size={20} />
          </IconButton>
        </View>

        {searchOpen ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 16,
              paddingBottom: 10,
            }}
          >
            <TextInput
              autoFocus
              onChangeText={setSearchInput}
              onSubmitEditing={() => setQuery(searchInput.trim())}
              placeholder="토론방·종목 이름 검색"
              placeholderTextColor={t.fgSubtle}
              returnKeyType="search"
              style={{
                flex: 1,
                height: 40,
                borderRadius: 10,
                backgroundColor: t.bgSubtle,
                paddingHorizontal: 12,
                color: t.fgStrong,
                fontSize: 14,
              }}
              value={searchInput}
            />
            {searchInput || query ? (
              <Pressable hitSlop={6} onPress={clearSearch}>
                <Icon.close color={t.fgMuted} size={20} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {roomsQuery.isPending
          ? ROOM_SKELETON_KEYS.map((key) => (
              <DiscussionRoomRowSkeleton key={key} />
            ))
          : null}

        {roomsQuery.isSuccess && rooms.length === 0
          ? renderEmpty(tab, isAuthed)
          : null}

        {rooms.map((r) => (
          <DiscussionRoomRow
            key={r.id}
            onDelete={
              isAdmin ? () => deleteRoom.mutate({ id: r.id }) : undefined
            }
            onEdit={
              isAdmin ? () => nav.openEditDiscussionRoom(r.id) : undefined
            }
            onPress={() => nav.openDiscussionRoom(r.id)}
            onToggleFavorite={() => handleToggleFavorite(r.id)}
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
