import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/icons";
import { SegmentedControl } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { SettingsGroup, SettingsScreen } from "@/screens/settings/ui";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";

type InquiryType = "signal" | "subscription" | "account" | "etc";

const TYPE_OPTIONS: { value: InquiryType; label: string }[] = [
  { value: "signal", label: "시그널" },
  { value: "subscription", label: "구독" },
  { value: "account", label: "계정" },
  { value: "etc", label: "기타" },
];

const TITLE_MAX = 100;
const CONTENT_MAX = 2000;

export default function InquiryFormScreen() {
  const { t } = useMrTheme();
  const [type, setType] = useState<InquiryType>("signal");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createInquiry = useMutation(orpc.inquiry.create.mutationOptions());

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedContent.length > 0 &&
    !createInquiry.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    createInquiry.mutate({
      type,
      title: trimmedTitle,
      content: trimmedContent,
    });
  };

  if (createInquiry.isSuccess) {
    return (
      <SettingsScreen title="1:1 문의">
        <View
          style={{
            alignItems: "center",
            paddingHorizontal: 32,
            paddingTop: 64,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              backgroundColor: t.successBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon.check color={t.success} size={30} />
          </View>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: t.fgStrong,
              marginTop: 18,
            }}
          >
            문의가 접수되었어요
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              color: t.fgMuted,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            확인 후 등록하신 이메일로 답변드릴게요.{"\n"}평일 09:00~18:00 내에
            순차적으로 응답합니다.
          </Text>
          <Pressable
            onPress={nav.back}
            style={{
              marginTop: 24,
              height: 48,
              alignSelf: "stretch",
              borderRadius: 12,
              backgroundColor: t.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
              확인
            </Text>
          </Pressable>
        </View>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen title="1:1 문의">
      <SettingsGroup
        label="문의 유형"
        sublabel="문의 내용에 가장 가까운 유형을 선택해 주세요."
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <SegmentedControl
            onChange={setType}
            options={TYPE_OPTIONS}
            value={type}
          />
        </View>
      </SettingsGroup>

      <SettingsGroup label="제목">
        <View style={{ paddingHorizontal: 16 }}>
          <TextInput
            maxLength={TITLE_MAX}
            onChangeText={setTitle}
            placeholder="문의 제목을 입력해 주세요."
            placeholderTextColor={t.fgSubtle}
            style={{
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
      </SettingsGroup>

      <SettingsGroup label="내용">
        <View style={{ paddingHorizontal: 16 }}>
          <TextInput
            maxLength={CONTENT_MAX}
            multiline
            onChangeText={setContent}
            placeholder="문의하실 내용을 자세히 적어주세요."
            placeholderTextColor={t.fgSubtle}
            style={{
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: t.fgStrong,
              minHeight: 140,
              textAlignVertical: "top",
            }}
            value={content}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {content.length}/{CONTENT_MAX}
          </Text>
        </View>
      </SettingsGroup>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
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
          {createInquiry.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
              문의 접수
            </Text>
          )}
        </Pressable>
        {createInquiry.isError ? (
          <Text
            style={{
              marginTop: 10,
              fontSize: 12,
              color: t.downStrong,
              textAlign: "center",
            }}
          >
            접수 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.
          </Text>
        ) : null}
      </View>
      <View style={{ height: 24 }} />
    </SettingsScreen>
  );
}
