import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

// admin이 남의 메시지를 롱프레스했을 때 뜨는 [숨김][삭제] 액션시트.
// 본인 메시지/비관리자는 이 시트 대신 기존 단건삭제 Alert를 그대로 쓴다.
export function AdminMessageActionSheet({
  visible,
  onClose,
  onHide,
  onDelete,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onHide: () => void;
  onDelete: () => void;
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
          <Pressable
            onPress={onHide}
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
              숨김
            </Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: t.border }} />
          <Pressable
            onPress={onDelete}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Icon.trash color={t.up} size={20} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: t.up }}>
              삭제
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
