import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

/* ----(비관리자 롱프레스 시트 — RFC 0008 D3/D17)---- */
// 비관리자가 메시지를 롱프레스하면 [답글] 하나만 뜬다. 본인 메시지도 마찬가지다
// — 삭제는 관리자만 할 수 있게 하기로 했다(D17). 그래서 이 시트에는 삭제가 없다.
//
// 관리자는 이 시트가 아니라 AdminMessageActionSheet([답글][숨김][삭제])를 쓴다.
export function ReplyActionSheet({
  visible,
  onClose,
  onReply,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
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
            onPress={onReply}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Icon.navDiscuss color={t.fgStrong} size={20} />
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}
            >
              답글
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
/* ----(~비관리자 롱프레스 시트 여기까지)---- */

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
  },
  root: {
    flex: 1,
  },
});
