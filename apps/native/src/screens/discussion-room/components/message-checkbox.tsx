import { Pressable, View } from "react-native";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

// 체크박스 글리프가 없으므로 테두리 View + Icon.check 조합으로 구성한다.
export function MessageCheckbox({
  checked,
  disabled,
  onPress,
  t,
}: {
  checked: boolean;
  disabled: boolean;
  onPress: () => void;
  t: MrTokens;
}) {
  return (
    <Pressable
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={{ paddingLeft: 12, paddingRight: 2, opacity: disabled ? 0.35 : 1 }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          borderWidth: 2,
          borderColor: checked ? t.primary : t.borderStrong,
          backgroundColor: checked ? t.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <Icon.check color="#fff" size={14} /> : null}
      </View>
    </Pressable>
  );
}
