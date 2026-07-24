import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

// Composer의 [+] 버튼이 여는 첨부 메뉴 (docs/rfcs/0004 기능5).
// "파일" 그룹 아래 두 갈래: 문서 피커(파일에서 선택)와 앱 내부 사진 그리드
// (앨범에서 선택). admin-message-action-sheet와 같은 하단 시트 패턴.
export function AttachMenu({
  visible,
  onClose,
  onPickFile,
  onPickPhotos,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onPickFile: () => void;
  onPickPhotos: () => void;
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
            style={{ alignItems: "center", paddingBottom: 6, paddingTop: 2 }}
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
              fontSize: 12,
              fontWeight: "800",
              color: t.fgSubtle,
              letterSpacing: 0.3,
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 4,
            }}
          >
            파일
          </Text>
          <Pressable
            onPress={onPickFile}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Icon.file color={t.fgStrong} size={20} />
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}
            >
              파일에서 선택
            </Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: t.border }} />
          <Pressable
            onPress={onPickPhotos}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Icon.image color={t.fgStrong} size={20} />
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}
            >
              앨범에서 선택
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
