import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SegmentedControl } from "@/components/ui";
import type { MrTokens } from "@/utils/theme";

export type DurationMode = "mute" | "block";
export type DurationUnit = "hour" | "day";

const UNIT_OPTIONS: { value: DurationUnit; label: string }[] = [
  { value: "hour", label: "시간" },
  { value: "day", label: "일" },
];

// 상한(docs/rfcs/0004 기능4): 뮤트 24시간/1일, 차단 7일.
const CAPS: Record<DurationMode, { hour: number; day: number }> = {
  mute: { hour: 24, day: 1 },
  block: { hour: 168, day: 7 },
};

const COPY: Record<
  DurationMode,
  { title: string; notice: string; confirm: string }
> = {
  mute: {
    title: "뮤트 기간",
    notice: "최대 24시간(1일)까지 뮤트할 수 있어요.",
    confirm: "저장",
  },
  block: {
    title: "차단 기간",
    notice: "최대 7일까지 차단할 수 있어요.",
    confirm: "확인",
  },
};

function digitsOnly(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// 숫자 TextInput + [시간][일] 토글. 저장 시 (value, unit)을 부모로 넘긴다.
// mute는 바로 muteMember, block은 부모에서 강퇴 확인 Alert 후 blockMember.
export function MemberDurationSheet({
  visible,
  mode,
  memberName,
  isPending,
  onClose,
  onConfirm,
  t,
}: {
  visible: boolean;
  mode: DurationMode;
  memberName: string;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (value: number, unit: DurationUnit) => void;
  t: MrTokens;
}) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [unit, setUnit] = useState<DurationUnit>("hour");

  const reset = () => {
    setInput("");
    setUnit("hour");
  };

  const value = digitsOnly(input);
  const cap = CAPS[mode][unit];
  const copy = COPY[mode];
  const withinCap = value > 0 && value <= cap;
  const canConfirm = withinCap && !isPending;

  const handleConfirm = () => {
    if (!canConfirm) {
      return;
    }
    onConfirm(value, unit);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={reset}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable onPress={onClose} style={styles.backdrop} />
        <View
          style={{
            backgroundColor: t.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: insets.bottom + 12,
          }}
        >
          <View
            style={{ alignItems: "center", paddingBottom: 4, paddingTop: 10 }}
          >
            <View
              style={{
                backgroundColor: t.borderStrong,
                borderRadius: 999,
                height: 5,
                width: 40,
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <Text
              style={{
                color: t.fgStrong,
                fontSize: 20,
                fontWeight: "800",
                letterSpacing: -0.4,
              }}
            >
              {copy.title}
            </Text>
            <Text
              style={{
                color: t.fgMuted,
                fontSize: 13,
                fontWeight: "600",
                marginTop: 6,
              }}
            >
              {memberName}님 · {copy.notice}
            </Text>
          </View>

          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 20,
              paddingTop: 16,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: t.bgSubtle,
                borderRadius: 10,
                flex: 1,
                flexDirection: "row",
                height: 48,
                paddingHorizontal: 14,
              }}
            >
              <TextInput
                autoFocus
                keyboardType="number-pad"
                onChangeText={setInput}
                placeholder="기간 입력"
                placeholderTextColor={t.fgSubtle}
                style={{
                  color: t.fgStrong,
                  flex: 1,
                  fontSize: 16,
                  fontWeight: "700",
                  padding: 0,
                }}
                value={input}
              />
            </View>
            <SegmentedControl
              onChange={setUnit}
              options={UNIT_OPTIONS}
              value={unit}
            />
          </View>

          {value > 0 && !withinCap ? (
            <Text
              style={{
                color: t.down,
                fontSize: 12,
                fontWeight: "600",
                paddingHorizontal: 20,
                paddingTop: 8,
              }}
            >
              {copy.notice}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 20,
              paddingTop: 16,
            }}
          >
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                backgroundColor: t.bgSubtle,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "700", color: t.fgStrong }}
              >
                취소
              </Text>
            </Pressable>
            <Pressable
              disabled={!canConfirm}
              onPress={handleConfirm}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                backgroundColor: canConfirm ? t.primary : t.bgMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: canConfirm ? "#fff" : t.fgSubtle,
                  }}
                >
                  {copy.confirm}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
  },
  root: {
    flex: 1,
  },
});
