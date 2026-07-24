import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import { IconButton, MrScreen, StockLogo } from "@/components/ui";
import { useLiveQuote } from "@/hooks/use-live-quotes";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";
import { findStock, type Stock } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";
import { AdminMessageActionSheet } from "./components/admin-message-action-sheet";
import { BlindReasonSheet } from "./components/blind-reason-sheet";
import { MessageCheckbox } from "./components/message-checkbox";
import { SelectionBar } from "./components/selection-bar";

type SelectionMode = "hide" | "delete";

const AVATAR_PALETTE = [
  "#256EF4",
  "#6A4DD6",
  "#198043",
  "#C97A0A",
  "#D6212F",
  "#0064B0",
  "#39506C",
];

const MESSAGE_LIMIT = 50;
const POLL_INTERVAL_MS = 5000; // ADR-0001 #1: room-only foreground polling.

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: 32-bit integer hash
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

type Message = {
  id: number;
  userId: string;
  userName: string;
  userImage: string | null;
  content: string | null;
  createdAt: string;
  deletedAt: string | null;
  blindedAt: string | null;
  blindReason: string | null;
};

type RoomData = {
  id: number;
  name: string;
  description: string;
  stockCode: string | null;
  stockName: string | null;
  sentiment: "up" | "neutral" | "down";
  createdBy: { id: string; name: string } | null;
  membersCount: number;
  time: string;
};

// ── MessageBubble + helpers ─────────────────────────────────────────

function MessageHeader({
  userName,
  isHost,
  t,
}: {
  userName: string;
  isHost: boolean;
  t: MrTokens;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingTop: 8,
        paddingBottom: 4,
        marginLeft: 36,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgStrong }}>
        {userName}
      </Text>
      {isHost ? (
        <View
          style={{
            paddingHorizontal: 6,
            height: 16,
            justifyContent: "center",
            borderRadius: 4,
            backgroundColor: t.primarySubtle,
          }}
        >
          <Text style={{ fontSize: 9, fontWeight: "800", color: t.primary }}>
            토픽 작성자
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MessageAvatar({ userName }: { userName: string }) {
  return (
    <View
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        backgroundColor: colorFor(userName),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>
        {userName.slice(0, 1)}
      </Text>
    </View>
  );
}

function bubbleText(message: Message, isDeleted: boolean, isBlinded: boolean) {
  if (isDeleted) {
    return "삭제된 메시지입니다";
  }
  if (isBlinded) {
    return `이 메시지는 '${message.blindReason ?? ""}' 사유로 가림 처리되었습니다.`;
  }
  return message.content ?? "";
}

function MessageBubbleBody({
  message,
  isSelf,
  isMasked,
  isDeleted,
  isBlinded,
  bubbleBg,
  textColor,
  inSelection,
  onLongPress,
  onToggleSelect,
  t,
}: {
  message: Message;
  isSelf: boolean;
  isMasked: boolean;
  isDeleted: boolean;
  isBlinded: boolean;
  bubbleBg: string;
  textColor: string;
  inSelection: boolean;
  onLongPress: () => void;
  onToggleSelect: () => void;
  t: MrTokens;
}) {
  return (
    <View
      style={{
        alignItems: isSelf ? "flex-end" : "flex-start",
        gap: 2,
        flexShrink: 1,
      }}
    >
      <Pressable
        disabled={isMasked}
        onLongPress={inSelection ? undefined : onLongPress}
        onPress={inSelection ? onToggleSelect : undefined}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderTopLeftRadius: isSelf ? 14 : 4,
          borderTopRightRadius: 14,
          borderBottomRightRadius: 14,
          borderBottomLeftRadius: 14,
          backgroundColor: bubbleBg,
          borderWidth: isSelf || isMasked ? 0 : 1,
          borderColor: t.border,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            lineHeight: 20,
            color: textColor,
            fontStyle: isMasked ? "italic" : "normal",
          }}
        >
          {bubbleText(message, isDeleted, isBlinded)}
        </Text>
      </Pressable>
      <Text
        style={{
          fontSize: 10,
          color: t.fgSubtle,
          fontWeight: "500",
          paddingHorizontal: 4,
        }}
      >
        {hhmm(message.createdAt)}
      </Text>
    </View>
  );
}

function MessageBubble({
  message,
  showHeader,
  isSelf,
  isHost,
  onLongPress,
  selectionMode,
  isSelected,
  onToggleSelect,
  t,
}: {
  message: Message;
  showHeader: boolean;
  isSelf: boolean;
  isHost: boolean;
  onLongPress: () => void;
  selectionMode: SelectionMode | null;
  isSelected: boolean;
  onToggleSelect: () => void;
  t: MrTokens;
}) {
  const isDeleted = Boolean(message.deletedAt);
  // isDeleted 스타일 브랜치를 미러한 가림(blind) 처리. blindedAt 있으면 말풍선은
  // 유지하되 사유 안내문을 이탤릭·subtle로 렌더한다(docs/rfcs/0004 기능2).
  const isBlinded = Boolean(message.blindedAt);
  const isMasked = isDeleted || isBlinded;
  const bubbleBg = isMasked ? t.bgSubtle : isSelf ? t.primary : t.bg;
  const textColor = isMasked ? t.fgSubtle : isSelf ? "#fff" : t.fgStrong;
  const showAvatar = !isSelf && showHeader;
  const showAvatarSpacer = !(isSelf || showHeader);
  const inSelection = selectionMode !== null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {inSelection ? (
        <MessageCheckbox
          checked={isSelected}
          disabled={isMasked}
          onPress={onToggleSelect}
          t={t}
        />
      ) : null}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 12,
          paddingVertical: 2,
          alignItems: isSelf ? "flex-end" : "flex-start",
        }}
      >
        {showHeader && !isSelf ? (
          <MessageHeader isHost={isHost} t={t} userName={message.userName} />
        ) : null}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "flex-end",
            maxWidth: "82%",
          }}
        >
          {showAvatar ? <MessageAvatar userName={message.userName} /> : null}
          {showAvatarSpacer ? <View style={{ width: 28 }} /> : null}
          <MessageBubbleBody
            bubbleBg={bubbleBg}
            inSelection={inSelection}
            isBlinded={isBlinded}
            isDeleted={isDeleted}
            isMasked={isMasked}
            isSelf={isSelf}
            message={message}
            onLongPress={onLongPress}
            onToggleSelect={onToggleSelect}
            t={t}
            textColor={textColor}
          />
        </View>
      </View>
    </View>
  );
}

// ── header / pinned / composer ──────────────────────────────────────

function RoomStockGlyph({
  mockStock,
  stockLabel,
  t,
}: {
  mockStock: Stock | null;
  stockLabel: string | null;
  t: MrTokens;
}) {
  if (mockStock) {
    return <StockLogo radius={8} size={32} stock={mockStock} />;
  }
  if (stockLabel) {
    return (
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: t.bgMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "800", color: t.fgStrong }}>
          {stockLabel.slice(0, 1)}
        </Text>
      </View>
    );
  }
  return null;
}

function RoomHeader({
  room,
  mockStock,
  stockLabel,
  canLeave,
  onLeave,
  selectionCount,
  onCancelSelection,
  t,
  topInset,
}: {
  room: RoomData;
  mockStock: Stock | null;
  stockLabel: string | null;
  canLeave: boolean;
  onLeave: () => void;
  selectionCount: number | null;
  onCancelSelection: () => void;
  t: MrTokens;
  topInset: number;
}) {
  const live = useLiveQuote(room.stockCode ?? "");
  const headerBase = {
    paddingTop: topInset + 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: t.bg,
    borderBottomWidth: 1,
    borderBottomColor: t.border,
  };
  // 선택모드일 때는 헤더를 "N개 선택 · 취소"로 대체한다.
  if (selectionCount !== null) {
    return (
      <View style={headerBase}>
        <IconButton onPress={onCancelSelection}>
          <Icon.close color={t.fgStrong} size={20} />
        </IconButton>
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: "800",
            color: t.fgStrong,
          }}
        >
          {selectionCount}개 선택
        </Text>
        <Pressable hitSlop={8} onPress={onCancelSelection}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: t.primary }}>
            취소
          </Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={headerBase}>
      <IconButton onPress={nav.back}>
        <Icon.chevLeft color={t.fgStrong} size={24} />
      </IconButton>
      <Pressable
        disabled={!mockStock}
        onPress={() => mockStock && nav.openStock(mockStock.code)}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <RoomStockGlyph mockStock={mockStock} stockLabel={stockLabel} t={t} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 14, fontWeight: "800", color: t.fgStrong }}
            >
              {stockLabel ?? room.name}
            </Text>
            {live ? (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: changeColor(live.change, t),
                }}
              >
                {fmt.pct(live.changeRate)}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 1,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                backgroundColor: t.success,
              }}
            />
            <Text style={{ fontSize: 11, color: t.fgMuted }}>
              참여자 {room.membersCount}명
            </Text>
          </View>
        </View>
      </Pressable>
      {canLeave ? (
        <IconButton onPress={onLeave}>
          <Icon.close color={t.fgStrong} size={20} />
        </IconButton>
      ) : null}
    </View>
  );
}

function PinnedTopic({ room, t }: { room: RoomData; t: MrTokens }) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
        backgroundColor: t.bg,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <View
        style={{
          padding: 10,
          borderRadius: 10,
          backgroundColor: t.bgSubtle,
          borderWidth: 1,
          borderColor: t.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon.pin color={t.fgMuted} size={11} />
          <Text
            style={{
              fontSize: 10,
              fontWeight: "800",
              color: t.fgMuted,
              letterSpacing: 0.3,
            }}
          >
            토론 주제
          </Text>
          {room.sentiment === "neutral" ? null : (
            <View
              style={{
                marginLeft: "auto",
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 999,
                backgroundColor: room.sentiment === "up" ? t.upBg : t.downBg,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: room.sentiment === "up" ? t.upStrong : t.downStrong,
                }}
              >
                {room.sentiment === "up" ? "긍정" : "부정"}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "700",
            color: t.fgStrong,
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          {room.name}
        </Text>
        {room.description ? (
          <Text
            style={{
              fontSize: 12,
              color: t.fgMuted,
              marginTop: 3,
              lineHeight: 18,
            }}
          >
            {room.description}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 3 }}>
          {room.createdBy?.name ?? "관리자"} · {room.time}
        </Text>
      </View>
    </View>
  );
}

function Composer({
  draft,
  setDraft,
  onSend,
  isSending,
  t,
  bottomInset,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
  t: MrTokens;
  bottomInset: number;
}) {
  const canSend = draft.trim().length > 0 && !isSending;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: bottomInset + 12,
        backgroundColor: t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
        alignItems: "center",
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: t.bgSubtle,
          borderRadius: 20,
          paddingLeft: 14,
          paddingRight: 4,
          minHeight: 40,
        }}
      >
        <TextInput
          editable={!isSending}
          onChangeText={setDraft}
          onSubmitEditing={onSend}
          placeholder="의견을 입력하세요"
          placeholderTextColor={t.fgSubtle}
          returnKeyType="send"
          style={{
            flex: 1,
            fontSize: 14,
            color: t.fgStrong,
            paddingVertical: 8,
          }}
          value={draft}
        />
        <Pressable
          disabled={!canSend}
          onPress={onSend}
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            backgroundColor: canSend ? t.primary : t.bgMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Icon.send color={canSend ? "#fff" : t.fgSubtle} size={16} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// 비로그인 시 메시지 리스트 위에 반투명 레이어를 깔아 텍스트는 못 읽지만
// 말풍선의 흐름은 어렴풋이 보이게 한다(대화 활성도는 짐작 가능).
function GuestOverlay({ t }: { t: MrTokens }) {
  return (
    <Pressable
      onPress={nav.openLogin}
      style={[
        StyleSheet.absoluteFillObject,
        {
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          backgroundColor: `${t.bg}E6`,
        },
      ]}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: t.bg,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.border,
          paddingHorizontal: 20,
          paddingVertical: 18,
          gap: 6,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: t.fgStrong,
          }}
        >
          로그인하면 대화를 볼 수 있어요
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: t.fgMuted,
          }}
        >
          탭하면 로그인 화면으로 이동해요.
        </Text>
      </View>
    </Pressable>
  );
}

function MessageList({
  messages,
  currentUserId,
  hostUserId,
  scrollRef,
  onLongPress,
  selectionMode,
  selectedIds,
  onToggleSelect,
  isPending,
  isEmpty,
  t,
}: {
  messages: Message[];
  currentUserId: string | null;
  hostUserId: string | null;
  scrollRef: React.RefObject<ScrollView | null>;
  onLongPress: (m: Message) => void;
  selectionMode: SelectionMode | null;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  isPending: boolean;
  isEmpty: boolean;
  t: MrTokens;
}) {
  return (
    <ScrollView
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor: t.bgSubtle }}
    >
      {isPending ? (
        <View style={{ paddingVertical: 48, alignItems: "center" }}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : null}
      {isEmpty ? (
        <Text
          style={{
            paddingHorizontal: 12,
            paddingTop: 32,
            paddingBottom: 8,
            textAlign: "center",
            fontSize: 12,
            color: t.fgSubtle,
          }}
        >
          아직 메시지가 없습니다. 첫 의견을 남겨 보세요.
        </Text>
      ) : null}
      {messages.length > 0 ? (
        <Text
          style={{
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: 8,
            textAlign: "center",
            fontSize: 11,
            color: t.fgSubtle,
            fontWeight: "600",
          }}
        >
          자유롭게 의견을 나눠보세요
        </Text>
      ) : null}
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const showHeader = !prev || prev.userId !== m.userId;
        const isSelf = currentUserId === m.userId;
        const isHost = hostUserId !== null && hostUserId === m.userId;
        return (
          <MessageBubble
            isHost={isHost}
            isSelected={selectedIds.has(m.id)}
            isSelf={isSelf}
            key={m.id}
            message={m}
            onLongPress={() => onLongPress(m)}
            onToggleSelect={() => onToggleSelect(m.id)}
            selectionMode={selectionMode}
            showHeader={showHeader}
            t={t}
          />
        );
      })}
      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

// ── screen ──────────────────────────────────────────────────────────

function useDiscussionRoom(roomId: number, isValid: boolean) {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();

  const roomOptions = orpc.discussion.room.queryOptions({
    input: { id: roomId },
  });
  const roomQuery = useQuery({
    ...roomOptions,
    enabled: isValid,
    // RFC 0003 G1: 방 안 참여자수(사람수)도 5초 폴링으로 실시간 갱신.
    refetchInterval: POLL_INTERVAL_MS,
  });

  const messagesOptions = orpc.discussion.messages.queryOptions({
    input: { roomId, limit: MESSAGE_LIMIT },
  });
  const messagesQuery = useQuery({
    ...messagesOptions,
    enabled: isValid,
    refetchInterval: POLL_INTERVAL_MS,
    // TODO: pause polling on AppState=background via focusManager.
  });

  // RFC 0003 G3 (ADR-0001 #3 준수): 메시지 전송/삭제 후 메시지 목록뿐 아니라
  // 토론 목록·방 카운트(사람수·말풍선)도 무효화해 즉시 반영되게 한다.
  const invalidateAfterMessageChange = () => {
    queryClient.invalidateQueries({ queryKey: messagesOptions.queryKey });
    queryClient.invalidateQueries({ queryKey: orpc.discussion.rooms.key() });
    queryClient.invalidateQueries({ queryKey: roomOptions.queryKey });
  };

  const sendMutation = useMutation(
    orpc.discussion.send.mutationOptions({
      onSuccess: invalidateAfterMessageChange,
    })
  );
  const deleteMutation = useMutation(
    orpc.discussion.deleteMessage.mutationOptions({
      onSuccess: invalidateAfterMessageChange,
    })
  );
  // Admin bulk 가림/삭제 (docs/rfcs/0004 기능2).
  const hideMessagesMutation = useMutation(
    orpc.discussion.hideMessages.mutationOptions({
      onSuccess: invalidateAfterMessageChange,
    })
  );
  const deleteMessagesMutation = useMutation(
    orpc.discussion.deleteMessages.mutationOptions({
      onSuccess: invalidateAfterMessageChange,
    })
  );
  const leaveMutation = useMutation(
    orpc.discussion.leaveRoom.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: orpc.discussion.rooms.key(),
        });
        nav.back();
      },
    })
  );

  return {
    session,
    roomQuery,
    messagesQuery,
    sendMutation,
    deleteMutation,
    hideMessagesMutation,
    deleteMessagesMutation,
    leaveMutation,
  };
}

function NotFoundView({ t, topInset }: { t: MrTokens; topInset: number }) {
  return (
    <MrScreen>
      <View
        style={{
          paddingTop: topInset + 16,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <IconButton onPress={nav.back}>
          <Icon.chevLeft color={t.fgStrong} size={24} />
        </IconButton>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 14, color: t.fgMuted }}>
          토론방을 찾을 수 없습니다.
        </Text>
      </View>
    </MrScreen>
  );
}

export default function DiscussionRoomScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const roomId = Number(idParam);
  const isValidRoomId = Number.isFinite(roomId) && roomId > 0;

  const {
    session,
    roomQuery,
    messagesQuery,
    sendMutation,
    deleteMutation,
    hideMessagesMutation,
    deleteMessagesMutation,
    leaveMutation,
  } = useDiscussionRoom(roomId, isValidRoomId);

  const currentUserId = session?.user.id ?? null;
  const isAdmin = session?.user.role === "admin";

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const initialScrollDone = useRef(false);

  // Admin 가림/삭제 UX 상태 (docs/rfcs/0004 기능2).
  // actionMessage: 롱프레스로 액션시트를 띄운 대상 메시지.
  // selectionMode: null이면 선택모드 아님. selectedIds: 선택된 메시지 id 집합.
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionMode | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [reasonSheetOpen, setReasonSheetOpen] = useState(false);

  // Initial scroll-to-end once messages first load. Subsequent polls do NOT
  // auto-scroll — users reading older messages shouldn't be yanked.
  useEffect(() => {
    if (!initialScrollDone.current && messagesQuery.isSuccess) {
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [messagesQuery.isSuccess]);

  const handleSend = () => {
    const content = draft.trim();
    if (!(content && isValidRoomId && session?.user)) {
      return;
    }
    sendMutation.mutate(
      { roomId, content },
      {
        onSuccess: () => {
          setDraft("");
          requestAnimationFrame(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          });
        },
      }
    );
  };

  const handleLongPress = (message: Message) => {
    if (message.deletedAt || message.blindedAt) {
      return;
    }
    // Admin이 남의 메시지를 롱프레스하면 [숨김][삭제] 액션시트를 연다.
    if (isAdmin && message.userId !== currentUserId) {
      setActionMessage(message);
      return;
    }
    // 본인 메시지/비관리자는 기존 단건삭제 Alert 유지.
    const canDelete = currentUserId === message.userId || isAdmin;
    if (!canDelete) {
      return;
    }
    Alert.alert("메시지 삭제", "이 메시지를 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: () => deleteMutation.mutate({ messageId: message.id }),
      },
    ]);
  };

  const exitSelection = () => {
    setSelectionMode(null);
    setSelectedIds(new Set());
    setReasonSheetOpen(false);
  };

  const enterSelection = (mode: SelectionMode) => {
    const seed = actionMessage
      ? new Set([actionMessage.id])
      : new Set<number>();
    setSelectionMode(mode);
    setSelectedIds(seed);
    setActionMessage(null);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const submitSelection = () => {
    const messageIds = [...selectedIds];
    if (messageIds.length === 0) {
      return;
    }
    if (selectionMode === "delete") {
      deleteMessagesMutation.mutate(
        { roomId, messageIds },
        { onSuccess: exitSelection }
      );
      return;
    }
    // 숨김: 사유 picker 시트를 연다. 저장 시 hideMessages 호출.
    setReasonSheetOpen(true);
  };

  const saveBlindReason = (reason: string) => {
    const messageIds = [...selectedIds];
    if (messageIds.length === 0) {
      setReasonSheetOpen(false);
      return;
    }
    hideMessagesMutation.mutate(
      { roomId, messageIds, reason },
      { onSuccess: exitSelection }
    );
  };

  const handleLeave = () => {
    if (!session?.user) {
      return;
    }
    Alert.alert("방 나가기", "이 토론방에서 나갈까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "나가기",
        style: "destructive",
        onPress: () => leaveMutation.mutate({ roomId }),
      },
    ]);
  };

  if (!isValidRoomId) {
    return <NotFoundView t={t} topInset={insets.top} />;
  }
  if (roomQuery.isPending) {
    return (
      <MrScreen>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={t.primary} />
        </View>
      </MrScreen>
    );
  }
  const room = roomQuery.data;
  if (!room) {
    return <NotFoundView t={t} topInset={insets.top} />;
  }

  const mockStock = room.stockCode ? (findStock(room.stockCode) ?? null) : null;
  const stockLabel = room.stockName ?? mockStock?.name ?? null;
  const messages = messagesQuery.data?.messages ?? [];
  const isLoggedIn = Boolean(session?.user);
  const inSelection = selectionMode !== null;

  return (
    <MrScreen>
      <RoomHeader
        canLeave={isLoggedIn}
        mockStock={mockStock}
        onCancelSelection={exitSelection}
        onLeave={handleLeave}
        room={room}
        selectionCount={inSelection ? selectedIds.size : null}
        stockLabel={stockLabel}
        t={t}
        topInset={insets.top}
      />
      <PinnedTopic room={room} t={t} />
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          <MessageList
            currentUserId={currentUserId}
            hostUserId={room.createdBy?.id ?? null}
            isEmpty={messagesQuery.isSuccess && messages.length === 0}
            isPending={messagesQuery.isPending}
            messages={messages}
            onLongPress={handleLongPress}
            onToggleSelect={toggleSelect}
            scrollRef={scrollRef}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
            t={t}
          />
          {isLoggedIn ? null : <GuestOverlay t={t} />}
        </View>
        {renderBottom({
          inSelection,
          selectionMode,
          selectedCount: selectedIds.size,
          isLoggedIn,
          isSubmitPending:
            hideMessagesMutation.isPending || deleteMessagesMutation.isPending,
          onSubmit: submitSelection,
          draft,
          setDraft,
          onSend: handleSend,
          isSending: sendMutation.isPending,
          bottomInset: insets.bottom,
          t,
        })}
      </KeyboardAvoidingView>
      <AdminMessageActionSheet
        onClose={() => setActionMessage(null)}
        onDelete={() => enterSelection("delete")}
        onHide={() => enterSelection("hide")}
        t={t}
        visible={actionMessage !== null}
      />
      <BlindReasonSheet
        count={selectedIds.size}
        onCancel={() => setReasonSheetOpen(false)}
        onSave={saveBlindReason}
        t={t}
        visible={reasonSheetOpen}
      />
    </MrScreen>
  );
}

// 하단 영역: 선택모드면 pill(SelectionBar), 아니면 로그인 시 Composer.
function renderBottom({
  inSelection,
  selectionMode,
  selectedCount,
  isLoggedIn,
  isSubmitPending,
  onSubmit,
  draft,
  setDraft,
  onSend,
  isSending,
  bottomInset,
  t,
}: {
  inSelection: boolean;
  selectionMode: SelectionMode | null;
  selectedCount: number;
  isLoggedIn: boolean;
  isSubmitPending: boolean;
  onSubmit: () => void;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  isSending: boolean;
  bottomInset: number;
  t: MrTokens;
}) {
  if (inSelection && selectionMode) {
    return (
      <SelectionBar
        bottomInset={bottomInset}
        count={selectedCount}
        isPending={isSubmitPending}
        mode={selectionMode}
        onSubmit={onSubmit}
        t={t}
      />
    );
  }
  if (isLoggedIn) {
    return (
      <Composer
        bottomInset={bottomInset}
        draft={draft}
        isSending={isSending}
        onSend={onSend}
        setDraft={setDraft}
        t={t}
      />
    );
  }
  return null;
}
