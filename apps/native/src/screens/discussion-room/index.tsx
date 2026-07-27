import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
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
/* ----(첨부 저장/열기, RFC 0004 기능5 후속 · RFC 0005)---- */
import {
  attachmentErrorCode,
  downloadDiscussionFile,
  NO_VIEWER_APP,
  needsSaveFolderChoice,
  openAttachment,
  PICK_CANCELLED,
  savedFileName,
  savedFileNames,
} from "@/lib/discussion-download";
/* ----(~첨부 저장/열기 여기까지)---- */
import {
  uploadDiscussionFile,
  uploadDiscussionImage,
} from "@/lib/discussion-upload";
import { findStock, type Stock } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";
import { AdminMessageActionSheet } from "./components/admin-message-action-sheet";
import { AttachMenu } from "./components/attach-menu";
import { BlindReasonSheet } from "./components/blind-reason-sheet";
import {
  type BubbleFile,
  FileBubble,
  type FileSaveState,
} from "./components/file-bubble";
import {
  type BubbleImage,
  ImageGridBubble,
} from "./components/image-grid-bubble";
/* ----(전체화면 이미지 뷰어)---- */
import { ImageViewer } from "./components/image-viewer";
/* ----(~전체화면 이미지 뷰어 여기까지)---- */
import { MemberListSheet } from "./components/member-list-sheet";
import { MessageCheckbox } from "./components/message-checkbox";
import {
  PhotoGridPicker,
  type PickedPhoto,
} from "./components/photo-grid-picker";
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
  // Attachment kind + payloads (docs/rfcs/0004 기능5). image/file carry a
  // non-null array/object only while visible (server masks deleted/blinded).
  type: "text" | "image" | "file";
  images: BubbleImage[] | null;
  file: BubbleFile | null;
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

type BubbleKind = "image" | "file" | "text";

// Which visual the bubble renders. Masked (deleted/blinded) messages always
// fall back to placeholder text; the server nulls their attachments anyway.
function bubbleKind(message: Message, isMasked: boolean): BubbleKind {
  if (isMasked) {
    return "text";
  }
  if (
    message.type === "image" &&
    message.images != null &&
    message.images.length > 0
  ) {
    return "image";
  }
  if (message.type === "file" && message.file != null) {
    return "file";
  }
  return "text";
}

function BubbleContent({
  message,
  kind,
  isSelf,
  isMasked,
  isDeleted,
  isBlinded,
  textColor,
  fileState,
  onDownloadFile,
  onOpenFile,
  onPressImage,
  t,
}: {
  message: Message;
  kind: BubbleKind;
  isSelf: boolean;
  isMasked: boolean;
  isDeleted: boolean;
  isBlinded: boolean;
  textColor: string;
  /* ----(첨부 저장 상태 + 이미지 뷰어 진입)---- */
  fileState: FileSaveState;
  onDownloadFile: () => void;
  onOpenFile: () => void;
  onPressImage: (index: number) => void;
  /* ----(~첨부 저장 상태 + 이미지 뷰어 진입 여기까지)---- */
  t: MrTokens;
}) {
  if (kind === "image" && message.images) {
    return (
      <ImageGridBubble
        images={message.images}
        onPressImage={onPressImage}
        t={t}
      />
    );
  }
  if (kind === "file" && message.file) {
    return (
      <FileBubble
        file={message.file}
        isSelf={isSelf}
        onDownload={onDownloadFile}
        onOpen={onOpenFile}
        state={fileState}
        t={t}
      />
    );
  }
  return (
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
  );
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
  onOpenFile,
  fileState,
  onDownloadFile,
  onPressImage,
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
  onOpenFile: () => void;
  /* ----(첨부 저장 상태 + 이미지 뷰어 진입)---- */
  fileState: FileSaveState;
  onDownloadFile: () => void;
  onPressImage: (index: number) => void;
  /* ----(~첨부 저장 상태 + 이미지 뷰어 진입 여기까지)---- */
  t: MrTokens;
}) {
  const kind = bubbleKind(message, isMasked);
  const isAttachment = kind !== "text";

  // In selection mode a tap always toggles; otherwise a file bubble opens.
  let onPress: (() => void) | undefined;
  if (inSelection) {
    onPress = onToggleSelect;
  } else if (kind === "file") {
    onPress = onOpenFile;
  }

  /* ----(선택모드에서는 말풍선 안쪽 버튼도 선택 토글)---- */
  // 원형 버튼은 자체 Pressable이라 상위 탭을 가로챈다. 선택모드에서 저장/열기가
  // 시작되면 선택이 안 되는 것처럼 보이므로 동작을 토글로 바꿔 준다.
  const onFileDownload = inSelection ? onToggleSelect : onDownloadFile;
  const onFileOpen = inSelection ? onToggleSelect : onOpenFile;
  /* ----(~선택모드에서는 말풍선 안쪽 버튼도 선택 토글 여기까지)---- */

  // Attachments carry their own visual; text keeps the rounded bubble chrome.
  const chrome = isAttachment
    ? undefined
    : {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderTopLeftRadius: isSelf ? 14 : 4,
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
        borderBottomLeftRadius: 14,
        backgroundColor: bubbleBg,
        borderWidth: isSelf || isMasked ? 0 : 1,
        borderColor: t.border,
      };

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
        onPress={onPress}
        style={chrome}
      >
        <BubbleContent
          fileState={fileState}
          isBlinded={isBlinded}
          isDeleted={isDeleted}
          isMasked={isMasked}
          isSelf={isSelf}
          kind={kind}
          message={message}
          onDownloadFile={onFileDownload}
          onOpenFile={onFileOpen}
          onPressImage={onPressImage}
          t={t}
          textColor={textColor}
        />
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
  onOpenFile,
  fileState,
  onDownloadFile,
  onPressImage,
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
  onOpenFile: () => void;
  /* ----(첨부 저장 상태 + 이미지 뷰어 진입)---- */
  fileState: FileSaveState;
  onDownloadFile: () => void;
  onPressImage: (index: number) => void;
  /* ----(~첨부 저장 상태 + 이미지 뷰어 진입 여기까지)---- */
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
            fileState={fileState}
            inSelection={inSelection}
            isBlinded={isBlinded}
            isDeleted={isDeleted}
            isMasked={isMasked}
            isSelf={isSelf}
            message={message}
            onDownloadFile={onDownloadFile}
            onLongPress={onLongPress}
            onOpenFile={onOpenFile}
            onPressImage={onPressImage}
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
  isAdmin,
  onOpenMembers,
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
  isAdmin: boolean;
  onOpenMembers: () => void;
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
      {isAdmin ? (
        <IconButton onPress={onOpenMembers}>
          <Icon.menu color={t.fgStrong} size={22} />
        </IconButton>
      ) : null}
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
  onAttach,
  isSending,
  attachDisabled,
  t,
  bottomInset,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  onAttach: () => void;
  isSending: boolean;
  attachDisabled: boolean;
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
      <Pressable
        disabled={attachDisabled}
        onPress={onAttach}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.bgSubtle,
        }}
      >
        <Icon.plus color={attachDisabled ? t.fgSubtle : t.fgMuted} size={22} />
      </Pressable>
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
  onOpenFile,
  fileStates,
  onDownloadFile,
  onPressImage,
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
  onOpenFile: (m: Message) => void;
  /* ----(첨부 저장 상태 + 이미지 뷰어 진입)---- */
  fileStates: Map<number, FileSaveState>;
  onDownloadFile: (m: Message) => void;
  onPressImage: (m: Message, index: number) => void;
  /* ----(~첨부 저장 상태 + 이미지 뷰어 진입 여기까지)---- */
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
            fileState={fileStates.get(m.id) ?? "idle"}
            isHost={isHost}
            isSelected={selectedIds.has(m.id)}
            isSelf={isSelf}
            key={m.id}
            message={m}
            onDownloadFile={() => onDownloadFile(m)}
            onLongPress={() => onLongPress(m)}
            onOpenFile={() => onOpenFile(m)}
            onPressImage={(index) => onPressImage(m, index)}
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

// ── 첨부 저장 상태 seed 헬퍼 (RFC 0005 §4-2) ────────────────────────

/* ----(저장 폴더 파일명 집합 → 말풍선 상태)---- */
type FileSeed = { id: number; name: string };

// 파일 메시지만 추린다. 삭제·가림된 메시지는 서버가 file을 null로 지운다.
function fileSeeds(messages: Message[]): FileSeed[] {
  const seeds: FileSeed[] = [];
  for (const m of messages) {
    if (m.type === "file" && m.file) {
      seeds.push({ id: m.id, name: m.file.name });
    }
  }
  return seeds;
}

// 폴더를 다시 읽을지 판단하는 키. id와 파일명이 그대로면 조회를 건너뛴다.
function seedKeyOf(seeds: FileSeed[]): string {
  return seeds.map((seed) => `${seed.id}:${seed.name}`).join("|");
}

// 저장 폴더에 그 이름의 파일이 있으면 "저장됨". 진행 중(저장/열기)인 항목은
// 끝나기 전에 되돌아가면 안 되므로 건드리지 않는다. 바뀐 게 없으면 같은 Map을
// 돌려줘 불필요한 리렌더를 막는다.
function seedFileStates(
  prev: Map<number, FileSaveState>,
  seeds: FileSeed[],
  savedNames: Set<string>
): Map<number, FileSaveState> {
  const next = new Map(prev);
  let changed = false;
  for (const seed of seeds) {
    const current = next.get(seed.id);
    if (current === "downloading" || current === "opening") {
      continue;
    }
    const state: FileSaveState = savedNames.has(savedFileName(seed.name))
      ? "saved"
      : "idle";
    if (current !== state) {
      next.set(seed.id, state);
      changed = true;
    }
  }
  return changed ? next : prev;
}

// 첫 저장에서는 SAF 폴더 선택 화면이 먼저 뜬다. 설명 없이 파일 관리자가 열리면
// 당황하므로 한 번만 알려 주고 진행한다.
function askSaveFolderNotice(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "저장할 폴더를 골라주세요",
      "받은 파일을 어디에 저장할지 처음 한 번만 고르면, 다음부터는 그 폴더에 바로 저장돼요.",
      [
        { text: "취소", style: "cancel", onPress: () => resolve(false) },
        { text: "폴더 선택", onPress: () => resolve(true) },
      ],
      { onDismiss: () => resolve(false) }
    );
  });
}
/* ----(~저장 폴더 파일명 집합 → 말풍선 상태 여기까지)---- */

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
  // 관리자 멤버 목록 시트(RFC 0004 기능4).
  const [membersOpen, setMembersOpen] = useState(false);
  // 첨부(RFC 0004 기능5): [+] 메뉴 / 앨범 그리드 / 업로드 진행 상태.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [photoGridOpen, setPhotoGridOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  /* ----(첨부 저장 상태 + 전체화면 이미지 뷰어)---- */
  // messageId → 파일 저장 상태. 앱을 껐다 켜도 유지되도록 값의 출처는 실제
  // 저장 폴더에 같은 이름의 파일이 있는지다(아래 effect에서 seed). 저장 폴더를
  // 아직 고르지 않았으면 전부 idle로 남는다 — 목록을 그리다 폴더 선택 화면이
  // 튀어나오면 안 되므로, 폴더를 묻는 건 저장 버튼을 눌렀을 때뿐이다.
  const [fileStates, setFileStates] = useState<Map<number, FileSaveState>>(
    new Map()
  );
  const [viewer, setViewer] = useState<{
    images: BubbleImage[];
    index: number;
    senderName: string;
    createdAt: string;
  } | null>(null);
  // 폴더 선택 안내는 한 세션에 한 번만 띄운다(필요 여부 자체는 lib이 판단한다).
  const saveNoticeShownRef = useRef(false);
  /* ----(~첨부 저장 상태 + 전체화면 이미지 뷰어 여기까지)---- */

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

  /* ----(이미 저장된 파일 감지)---- */
  // 저장 폴더 목록을 **한 번** 읽어 이름 집합으로 대조한다(첨부마다 조회하면
  // SAF 왕복이 N번 난다). 폴더를 아직 고르지 않았으면 lib이 빈 집합을 주고
  // 피커는 뜨지 않는다. 메시지 목록은 5초 폴링마다 새 배열이라 그대로 두면
  // 5초마다 폴더를 다시 읽게 되므로, 파일 메시지 구성이 바뀔 때만 읽는다.
  const loadedMessages = messagesQuery.data?.messages;
  const seedKeyRef = useRef("");
  useEffect(() => {
    if (!loadedMessages) {
      return;
    }
    const seeds = fileSeeds(loadedMessages);
    const seedKey = seedKeyOf(seeds);
    if (seeds.length === 0 || seedKey === seedKeyRef.current) {
      return;
    }
    seedKeyRef.current = seedKey;

    // 언마운트/재조회 후에 늦게 도착한 결과로 setState 하지 않는다.
    let cancelled = false;
    (async () => {
      const names = await savedFileNames();
      if (cancelled) {
        return;
      }
      setFileStates((prev) => seedFileStates(prev, seeds, names));
    })();
    return () => {
      cancelled = true;
    };
  }, [loadedMessages]);
  /* ----(~이미 저장된 파일 감지 여기까지)---- */

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

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  /* ----(파일 저장 / 열기 / 이미지 뷰어)---- */
  // ↓ 버튼 → 저장 폴더에 내려받는다. 저장 위치를 코드에 박지 않으므로(§151)
  // 어디에 저장됐는지는 lib이 돌려주는 label을 그대로 보여준다.
  const handleDownloadFile = async (message: Message) => {
    const file = message.file;
    if (!file) {
      return;
    }
    // 저장 폴더를 고르게 해야 하는지는 lib이 판단한다(고를 것이 없는 기기에서는
    // 안내가 뜨지 않는다). 화면은 "물어봐야 하나"만 알면 된다.
    if (!saveNoticeShownRef.current && (await needsSaveFolderChoice())) {
      saveNoticeShownRef.current = true;
      const goAhead = await askSaveFolderNotice();
      if (!goAhead) {
        return;
      }
    }
    setFileStates((prev) => new Map(prev).set(message.id, "downloading"));
    try {
      const { label } = await downloadDiscussionFile(
        file.url,
        file.name,
        file.mime
      );
      setFileStates((prev) => new Map(prev).set(message.id, "saved"));
      Alert.alert("저장 완료", `${label}에 저장했어요.`);
    } catch (err) {
      // 진행중이면 버튼이 잠기므로 어떤 경우든 먼저 idle로 되돌려 재시도를
      // 열어 둔다.
      setFileStates((prev) => new Map(prev).set(message.id, "idle"));
      // 폴더 선택을 취소한 건 실패가 아니라 "안 골랐음"이다 — 조용히 되돌린다.
      if (attachmentErrorCode(err) === PICK_CANCELLED) {
        return;
      }
      Alert.alert(
        "저장 실패",
        err instanceof Error ? err.message : "파일을 저장하지 못했어요."
      );
    }
  };

  // 열 앱이 없는 형식(오피스·hwp 등)은 저장을 권한다. 저장해 두면 나중에 파일
  // 관리자나 다른 앱에서 열 수 있다(RFC 0005 §4-5).
  const handleOpenFileError = (err: unknown, message: Message) => {
    if (attachmentErrorCode(err) === NO_VIEWER_APP) {
      Alert.alert(
        "열 수 있는 앱이 없어요",
        "이 형식을 열 수 있는 앱이 폰에 없어요. 저장해 두면 나중에 다른 앱으로 열어볼 수 있어요.",
        [
          { text: "취소", style: "cancel" },
          { text: "저장하기", onPress: () => handleDownloadFile(message) },
        ]
      );
      return;
    }
    Alert.alert(
      "열기 실패",
      err instanceof Error ? err.message : "파일을 열 수 없어요."
    );
  };

  // 이름 탭 → 저장돼 있으면 그 저장본을, 아니면 앱 캐시로 받아서 폰에 설치된
  // 앱으로 연다(캐시본은 저장 폴더에 남지 않아 "저장 안 함" 상태가 유지된다).
  // 바이트는 세션 쿠키를 실은 서버 프록시로만 받고, 외부 앱에는 로컬 content://
  // 만 넘어간다(RFC 0004 §158·§191·§203). 저장 폴더 피커는 뜨지 않는다.
  const handleOpenFile = async (message: Message) => {
    const file = message.file;
    if (!file) {
      return;
    }
    // 캐시로 받는 데 수 초가 걸릴 수 있어 "여는 중"을 표시하고, 끝나면 원래
    // 상태로 되돌린다(연다고 저장 여부가 바뀌지는 않는다).
    const restoreState = fileStates.get(message.id) ?? "idle";
    setFileStates((prev) => new Map(prev).set(message.id, "opening"));
    try {
      await openAttachment(file.url, file.name, file.mime);
    } catch (err) {
      handleOpenFileError(err, message);
    } finally {
      setFileStates((prev) => new Map(prev).set(message.id, restoreState));
    }
  };

  const handlePressImage = (message: Message, index: number) => {
    if (!message.images) {
      return;
    }
    setViewer({
      images: message.images,
      index,
      senderName: message.userName,
      createdAt: message.createdAt,
    });
  };
  /* ----(~파일 저장 / 열기 / 이미지 뷰어 여기까지)---- */

  // 문서 피커(단일) → /upload/discussion-file → file 메시지 전송.
  // 광범위 저장소 권한 X.
  const handlePickFile = async () => {
    setAttachMenuOpen(false);
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
      });
    } catch {
      Alert.alert("전송 실패", "파일을 불러오지 못했어요.");
      return;
    }
    const asset = result.canceled ? null : result.assets[0];
    if (!(asset && isValidRoomId)) {
      return;
    }
    setIsUploading(true);
    try {
      const ref = await uploadDiscussionFile({
        uri: asset.uri,
        name: asset.name,
        mime: asset.mimeType ?? "application/octet-stream",
      });
      await sendMutation.mutateAsync({ roomId, file: ref });
      scrollToEnd();
    } catch (err) {
      Alert.alert(
        "전송 실패",
        err instanceof Error ? err.message : "파일을 보내지 못했어요."
      );
    } finally {
      setIsUploading(false);
    }
  };

  // 선택 이미지 업로드 후 성공분만 하나의 image 메시지로 전송. 부분 실패는
  // 재시도 가능(실패분만 다시 시도)(RFC 0004 기능5).
  const uploadAndSendPhotos = async (photos: PickedPhoto[]) => {
    if (photos.length === 0) {
      return;
    }
    setIsUploading(true);
    try {
      const results = await Promise.all(
        photos.map(async (p) => {
          try {
            const id = await uploadDiscussionImage({
              uri: p.uri,
              name: p.name,
              mime: p.mime,
            });
            return { ok: true as const, id };
          } catch {
            return { ok: false as const, photo: p };
          }
        })
      );
      const imageIds: number[] = [];
      const failed: PickedPhoto[] = [];
      for (const r of results) {
        if (r.ok) {
          imageIds.push(r.id);
        } else {
          failed.push(r.photo);
        }
      }
      if (imageIds.length > 0) {
        await sendMutation.mutateAsync({ roomId, imageIds });
        scrollToEnd();
      }
      if (failed.length > 0) {
        const onlyFailures = imageIds.length === 0;
        Alert.alert(
          onlyFailures ? "업로드 실패" : "일부 업로드 실패",
          `${failed.length}장을 보내지 못했어요.`,
          [
            { text: "취소", style: "cancel" },
            { text: "재시도", onPress: () => uploadAndSendPhotos(failed) },
          ]
        );
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmPhotos = (photos: PickedPhoto[]) => {
    setPhotoGridOpen(false);
    uploadAndSendPhotos(photos);
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

  // 차단된 방(RFC 0004 기능4): 메시지/입력창 대신 안내만 노출한다.
  if (room.blocked) {
    return (
      <MrScreen>
        <RoomHeader
          canLeave={isLoggedIn}
          isAdmin={false}
          mockStock={mockStock}
          onCancelSelection={exitSelection}
          onLeave={handleLeave}
          onOpenMembers={() => setMembersOpen(true)}
          room={room}
          selectionCount={null}
          stockLabel={stockLabel}
          t={t}
          topInset={insets.top}
        />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: t.fgMuted }}>
            차단된 방입니다
          </Text>
        </View>
      </MrScreen>
    );
  }

  return (
    <MrScreen>
      <RoomHeader
        canLeave={isLoggedIn}
        isAdmin={isAdmin}
        mockStock={mockStock}
        onCancelSelection={exitSelection}
        onLeave={handleLeave}
        onOpenMembers={() => setMembersOpen(true)}
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
            fileStates={fileStates}
            hostUserId={room.createdBy?.id ?? null}
            isEmpty={messagesQuery.isSuccess && messages.length === 0}
            isPending={messagesQuery.isPending}
            messages={messages}
            onDownloadFile={handleDownloadFile}
            onLongPress={handleLongPress}
            onOpenFile={handleOpenFile}
            onPressImage={handlePressImage}
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
          onAttach: () => setAttachMenuOpen(true),
          isSending: sendMutation.isPending || isUploading,
          attachDisabled: isUploading,
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
      <MemberListSheet
        isAdmin={isAdmin}
        onClose={() => setMembersOpen(false)}
        roomId={roomId}
        t={t}
        visible={membersOpen}
      />
      <AttachMenu
        onClose={() => setAttachMenuOpen(false)}
        onPickFile={handlePickFile}
        onPickPhotos={() => {
          setAttachMenuOpen(false);
          setPhotoGridOpen(true);
        }}
        t={t}
        visible={attachMenuOpen}
      />
      <PhotoGridPicker
        onClose={() => setPhotoGridOpen(false)}
        onConfirm={handleConfirmPhotos}
        t={t}
        visible={photoGridOpen}
      />
      {/* ----(전체화면 이미지 뷰어)---- */}
      {viewer ? (
        <ImageViewer
          createdAt={viewer.createdAt}
          images={viewer.images}
          initialIndex={viewer.index}
          onClose={() => setViewer(null)}
          senderName={viewer.senderName}
          visible
        />
      ) : null}
      {/* ----(~전체화면 이미지 뷰어 여기까지)---- */}
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
  onAttach,
  isSending,
  attachDisabled,
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
  onAttach: () => void;
  isSending: boolean;
  attachDisabled: boolean;
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
        attachDisabled={attachDisabled}
        bottomInset={bottomInset}
        draft={draft}
        isSending={isSending}
        onAttach={onAttach}
        onSend={onSend}
        setDraft={setDraft}
        t={t}
      />
    );
  }
  return null;
}
