import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icons";
import { MrBottomSheet } from "@/components/mr-bottom-sheet";
import type { MrTokens } from "@/utils/theme";

// admin이 메시지를 롱프레스했을 때 뜨는 액션시트.
/* ----(답글 항목 추가 — RFC 0008 D2)---- */
// [숨김][삭제] 2개였는데 [답글]이 맨 위에 붙어 3개가 됐다. 답글은 누구나 다는
// 것이라 파괴적 동작(숨김·삭제)보다 위에 둔다.
// 비관리자는 이 시트 대신 ReplyActionSheet([답글] 1개)를 쓴다(D3).
/* ----(~답글 항목 추가 여기까지)---- */
export function AdminMessageActionSheet({
  visible,
  onClose,
  onReply,
  onHide,
  onDelete,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onHide: () => void;
  onDelete: () => void;
  t: MrTokens;
}) {
  return (
    <MrBottomSheet onClose={onClose} t={t} visible={visible}>
      {/* ----(답글 — RFC 0008 D2)---- */}
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
        <Text style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}>
          답글
        </Text>
      </Pressable>
      <View style={{ height: 1, backgroundColor: t.border }} />
      {/* ----(~답글 여기까지)---- */}
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
        <Text style={{ fontSize: 16, fontWeight: "700", color: t.fgStrong }}>
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
    </MrBottomSheet>
  );
}
