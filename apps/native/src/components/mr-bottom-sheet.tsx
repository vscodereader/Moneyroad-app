import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MrTokens } from "@/utils/theme";

/* ----(바텀시트 공용 뼈대)---- */
// 토론방 시트 7개가 각자 이 뼈대를 복사해 갖고 있었다 — Modal 배선, 전면
// 백드롭 Pressable, 상단 라운드 카드, 40x5 그랩바, 그리고 똑같은 StyleSheet.
// 스크림 농도나 라운드 값을 바꾸려면 7곳을 고쳐야 했다.
//
// ⚠️ 여백이 이미 세 갈래로 갈라져 있다(그랩바 10/2 · 6/2 · 4/10). 의도한 차이가
// 아니라 복붙이 따로 흘러간 결과지만, 지금 통일하면 7개 중 4개의 모습이 바뀐다.
// 그래서 여기서는 뼈대만 합치고 갈라진 값은 prop 으로 그대로 받는다. 통일은
// 화면을 보고 따로 정할 일이다.
export function MrBottomSheet({
  visible,
  onClose,
  t,
  children,
  grabberPaddingBottom = 10,
  grabberPaddingTop = 2,
  paddingTop = 8,
  maxHeight,
  onShow,
}: {
  visible: boolean;
  onClose: () => void;
  t: MrTokens;
  children: ReactNode;
  /** 열릴 때 내부 상태를 되돌려야 하는 폼 시트만 준다. */
  onShow?: () => void;
  /** 그랩바 아래 여백. 시트마다 달라 그대로 넘겨받는다. */
  grabberPaddingBottom?: number;
  /** 그랩바 위 여백. */
  grabberPaddingTop?: number;
  /** 카드 상단 여백. 목록형 시트는 주지 않는다. */
  paddingTop?: number;
  /** 내용이 길어질 수 있는 시트만 준다(예: "88%"). */
  maxHeight?: ViewStyle["maxHeight"];
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={onShow}
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
            paddingTop,
            ...(maxHeight === undefined ? null : { maxHeight }),
          }}
        >
          <View
            style={{
              alignItems: "center",
              paddingBottom: grabberPaddingBottom,
              paddingTop: grabberPaddingTop,
            }}
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
          {children}
        </View>
      </View>
    </Modal>
  );
}
/* ----(~바텀시트 공용 뼈대 여기까지)---- */

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.4)",
    flex: 1,
  },
  root: {
    flex: 1,
  },
});
