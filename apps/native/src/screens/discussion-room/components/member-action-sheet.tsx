import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

// 멤버를 롱프레스했을 때 뜨는 [mute][차단하기] 액션시트.
// AdminMessageActionSheet 패턴을 그대로 미러한다.
export function MemberActionSheet({
  visible,
  memberName,
  onClose,
  onMute,
  onBlock,
  t,
}: {
  visible: boolean;
  memberName: string;
  onClose: () => void;
  onMute: () => void;
  onBlock: () => void;
  t: MrTokens;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
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
            paddingTop: 8,
          }}
        >
          <View
            style={{ alignItems: "center", paddingBottom: 10, paddingTop: 2 }}
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
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: t.fgMuted,
              paddingHorizontal: 20,
              paddingBottom: 8,
            }}
          >
            {memberName}
          </Text>
          <Pressable
            onPress={onMute}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Icon.alert color={t.fgStrong} size={20} />
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}
            >
              mute
            </Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: t.border }} />
          <Pressable
            onPress={onBlock}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Icon.close color={t.up} size={20} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: t.up }}>
              차단하기
            </Text>
          </Pressable>
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
