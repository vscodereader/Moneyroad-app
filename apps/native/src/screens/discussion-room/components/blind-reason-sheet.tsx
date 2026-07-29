import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MrBottomSheet } from "@/components/mr-bottom-sheet";
import type { MrTokens } from "@/utils/theme";

// 가림(숨김) 사유 — 순서/문구 고정(docs/rfcs/0004 기능2).
export const BLIND_REASONS = [
  "혐오/차별적/생명경시/욕설 표현입니다",
  "스팸홍보/도배입니다",
  "음란물입니다",
  "불법정보를 포함하고 있습니다",
  "청소년에게 유해한 내용입니다",
  "개인정보가 노출되었습니다",
  "불쾌한 표현이 있습니다",
] as const;

// 라디오(단일선택) + [저장][취소]. 저장 시 선택한 사유 문자열을 그대로 넘긴다.
export function BlindReasonSheet({
  visible,
  count,
  onCancel,
  onSave,
  t,
}: {
  visible: boolean;
  count: number;
  onCancel: () => void;
  onSave: (reason: string) => void;
  t: MrTokens;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSave = () => {
    if (selected) {
      onSave(selected);
    }
  };

  const handleClose = () => {
    setSelected(null);
    onCancel();
  };

  return (
    <MrBottomSheet
      grabberPaddingBottom={4}
      grabberPaddingTop={10}
      maxHeight="88%"
      onClose={handleClose}
      onShow={() => setSelected(null)}
      paddingTop={0}
      t={t}
      visible={visible}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <Text
          style={{
            color: t.fgStrong,
            fontSize: 20,
            fontWeight: "800",
            letterSpacing: -0.4,
          }}
        >
          가림 사유를 선택하세요
        </Text>
        <Text
          style={{
            color: t.fgMuted,
            fontSize: 13,
            fontWeight: "600",
            marginTop: 6,
          }}
        >
          메시지 {count}개를 가림 처리합니다.
        </Text>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ marginTop: 8 }}
      >
        {BLIND_REASONS.map((reason) => {
          const active = selected === reason;
          return (
            <Pressable
              key={reason}
              onPress={() => setSelected(reason)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 20,
                paddingVertical: 14,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: active ? t.primary : t.borderStrong,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: t.primary,
                    }}
                  />
                ) : null}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 14,
                  color: t.fgStrong,
                  fontWeight: active ? "700" : "500",
                }}
              >
                {reason}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={{
          flexDirection: "row",
          gap: 10,
          paddingHorizontal: 20,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: t.border,
        }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            backgroundColor: t.bgSubtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}>
            취소
          </Text>
        </Pressable>
        <Pressable
          disabled={!selected}
          onPress={handleSave}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            backgroundColor: selected ? t.primary : t.bgMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: selected ? "#fff" : t.fgSubtle,
            }}
          >
            저장
          </Text>
        </Pressable>
      </View>
    </MrBottomSheet>
  );
}
