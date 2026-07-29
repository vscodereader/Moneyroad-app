import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icons";
import { MrBottomSheet } from "@/components/mr-bottom-sheet";
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
  return (
    // 그랩바 아래 여백만 6 으로 다르다 — 다른 시트는 10 이다. 의도된 차이는
    // 아니지만 지금 맞추면 이 메뉴의 모습이 바뀌므로 그대로 둔다.
    <MrBottomSheet
      grabberPaddingBottom={6}
      onClose={onClose}
      t={t}
      visible={visible}
    >
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
        <Text style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}>
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
        <Text style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}>
          앨범에서 선택
        </Text>
      </Pressable>
    </MrBottomSheet>
  );
}
