import { ActivityIndicator, Pressable, Text, View } from "react-native";

import type { MrTokens } from "@/utils/theme";

// 선택모드 하단 pill 버튼. mode에 따라 "숨김 (N)" / "삭제 (N)".
// 0개면 비활성. t.primary 배경 · 흰 볼드.
export function SelectionBar({
  mode,
  count,
  onSubmit,
  isPending,
  t,
  bottomInset,
}: {
  mode: "hide" | "delete";
  count: number;
  onSubmit: () => void;
  isPending: boolean;
  t: MrTokens;
  bottomInset: number;
}) {
  const label = mode === "hide" ? "숨김" : "삭제";
  const canSubmit = count > 0 && !isPending;

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: bottomInset + 12,
        backgroundColor: t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
      }}
    >
      <Pressable
        disabled={!canSubmit}
        onPress={onSubmit}
        style={{
          height: 48,
          borderRadius: 999,
          backgroundColor: canSubmit ? t.primary : t.bgMuted,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        }}
      >
        {isPending ? <ActivityIndicator color="#fff" size="small" /> : null}
        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color: canSubmit ? "#fff" : t.fgSubtle,
          }}
        >
          {`${label} (${count})`}
        </Text>
      </Pressable>
    </View>
  );
}
