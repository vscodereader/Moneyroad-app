import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BackButton,
  MrScreen,
  SegmentedControl,
  Switch,
} from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";

type NoticeCategory = "notice" | "update" | "event";

const CATEGORY_OPTIONS: { value: NoticeCategory; label: string }[] = [
  { value: "notice", label: "공지" },
  { value: "update", label: "업데이트" },
  { value: "event", label: "이벤트" },
];

const TITLE_MAX = 100;
const BODY_MAX = 2000;

export default function CreateNoticeScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<NoticeCategory>("notice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const createNotice = useMutation(
    orpc.notice.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.notice.list.key() });
        nav.back();
      },
    })
  );

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedBody.length > 0 &&
    !createNotice.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    createNotice.mutate({
      category,
      title: trimmedTitle,
      body: trimmedBody,
      pinned,
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
          새 공지사항
        </Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Category */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            분류
          </Text>
          <View style={{ marginTop: 8 }}>
            <SegmentedControl
              onChange={setCategory}
              options={CATEGORY_OPTIONS}
              value={category}
            />
          </View>
        </View>

        {/* Pinned */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}
              >
                최상단 고정
              </Text>
              <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 2 }}>
                목록 맨 위에 📌 핀으로 고정합니다.
              </Text>
            </View>
            <Switch on={pinned} onChange={setPinned} />
          </View>
        </View>

        {/* Title */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            제목 *
          </Text>
          <TextInput
            maxLength={TITLE_MAX}
            onChangeText={setTitle}
            placeholder="예: v1.5.0 업데이트 안내"
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
            value={title}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {title.length}/{TITLE_MAX}
          </Text>
        </View>

        {/* Body */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            내용 *
          </Text>
          <TextInput
            maxLength={BODY_MAX}
            multiline
            numberOfLines={6}
            onChangeText={setBody}
            placeholder="공지 내용을 입력하세요."
            placeholderTextColor={t.fgSubtle}
            style={{
              marginTop: 8,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: t.fgStrong,
              minHeight: 160,
              textAlignVertical: "top",
            }}
            value={body}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {body.length}/{BODY_MAX}
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
            {createNotice.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                공지 등록
              </Text>
            )}
          </Pressable>
          {createNotice.isError ? (
            <Text
              style={{
                marginTop: 10,
                fontSize: 12,
                color: t.downStrong,
                textAlign: "center",
              }}
            >
              등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
            </Text>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </MrScreen>
  );
}
