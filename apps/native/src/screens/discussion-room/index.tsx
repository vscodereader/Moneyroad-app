import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icons";
import { IconButton, MrScreen, StockLogo } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import {
  type ChatMessage,
  discussionRoomMessages,
  discussionRooms,
  findStock,
} from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import type { MrTokens } from "@/utils/theme";

const AVATAR_PALETTE = [
  "#256EF4",
  "#6A4DD6",
  "#198043",
  "#C97A0A",
  "#D6212F",
  "#0064B0",
  "#39506C",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: 32-bit integer hash
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function MessageBubble({
  message,
  showHeader,
  t,
}: {
  message: ChatMessage;
  showHeader: boolean;
  t: MrTokens;
}) {
  const isSelf = Boolean(message.self);
  const isHost = message.role === "host";
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 2,
        alignItems: isSelf ? "flex-end" : "flex-start",
      }}
    >
      {showHeader && !isSelf ? (
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
            {message.author}
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
              <Text
                style={{ fontSize: 9, fontWeight: "800", color: t.primary }}
              >
                토픽 작성자
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-end",
          maxWidth: "82%",
        }}
      >
        {isSelf
          ? null
          : showHeader && (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  backgroundColor: colorFor(message.author),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}
                >
                  {message.author.slice(0, 1)}
                </Text>
              </View>
            )}
        {isSelf || showHeader ? null : <View style={{ width: 28 }} />}
        <View
          style={{
            alignItems: isSelf ? "flex-end" : "flex-start",
            gap: 2,
            flexShrink: 1,
          }}
        >
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderTopLeftRadius: isSelf ? 14 : 4,
              borderTopRightRadius: 14,
              borderBottomRightRadius: isSelf ? 14 : 14,
              borderBottomLeftRadius: 14,
              backgroundColor: isSelf ? t.primary : t.bg,
              borderWidth: isSelf ? 0 : 1,
              borderColor: t.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                lineHeight: 20,
                color: isSelf ? "#fff" : t.fgStrong,
              }}
            >
              {message.text}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 4,
            }}
          >
            {message.sentiment === "up" ? (
              <Text
                style={{ fontSize: 10, fontWeight: "700", color: t.upStrong }}
              >
                ↑ 매수의견
              </Text>
            ) : null}
            {message.sentiment === "down" ? (
              <Text
                style={{ fontSize: 10, fontWeight: "700", color: t.downStrong }}
              >
                ↓ 매도의견
              </Text>
            ) : null}
            <Text
              style={{ fontSize: 10, color: t.fgSubtle, fontWeight: "500" }}
            >
              {message.time}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function DiscussionRoomScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const room = discussionRooms.find((r) => r.id === id) ?? discussionRooms[0];
  const stock = findStock(room.code);
  const seeded = discussionRoomMessages[room.id] ?? [];
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  const allMessages = [...seeded, ...extra];

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [extra.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setExtra((prev) => [
      ...prev,
      { id: `u${Date.now()}`, author: "나", text, time: "방금", self: true },
    ]);
    setDraft("");
  };

  return (
    <MrScreen>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 8,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: t.bg,
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <IconButton onPress={nav.back}>
          <Icon.chevLeft color={t.fgStrong} size={24} />
        </IconButton>
        <Pressable
          onPress={() => stock && nav.openStock(stock.code)}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {stock ? <StockLogo radius={8} size={32} stock={stock} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                numberOfLines={1}
                style={{ fontSize: 14, fontWeight: "800", color: t.fgStrong }}
              >
                {stock?.name}
              </Text>
              {stock ? (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: changeColor(stock.change, t),
                  }}
                >
                  {fmt.pct(stock.changePct)}
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
                참여자 {room.members}명
              </Text>
            </View>
          </View>
        </Pressable>
        <IconButton>
          <Icon.share color={t.fgStrong} size={20} />
        </IconButton>
      </View>

      {/* Pinned topic */}
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
            {room.title}
          </Text>
          <Text style={{ fontSize: 11, color: t.fgMuted, marginTop: 3 }}>
            {room.author} · {room.time}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, backgroundColor: t.bgSubtle }}
        >
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
            오늘 · 자유롭게 의견을 나눠보세요
          </Text>
          {allMessages.map((m, i) => {
            const prev = allMessages[i - 1];
            const showHeader = !prev || prev.author !== m.author;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                showHeader={showHeader}
                t={t}
              />
            );
          })}
          <View style={{ height: 12 }} />
        </ScrollView>

        {/* Composer */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: insets.bottom + 12,
            backgroundColor: t.bg,
            borderTopWidth: 1,
            borderTopColor: t.border,
            alignItems: "center",
          }}
        >
          <Pressable
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              backgroundColor: t.bgSubtle,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon.plus color={t.fgMuted} size={20} />
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
              onChangeText={setDraft}
              onSubmitEditing={send}
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
              disabled={!draft.trim()}
              onPress={send}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: draft.trim() ? t.primary : t.bgMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.send color={draft.trim() ? "#fff" : t.fgSubtle} size={16} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </MrScreen>
  );
}
