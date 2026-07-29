import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icons";
import { MrBottomSheet } from "@/components/mr-bottom-sheet";
import type { MrTokens } from "@/utils/theme";

// 멤버를 롱프레스했을 때 뜨는 [mute][차단하기] 액션시트.
// AdminMessageActionSheet 패턴을 그대로 미러한다.
export function MemberActionSheet({
  visible,
  memberName,
  blocked,
  onClose,
  onMute,
  onBlock,
  onUnblock,
  t,
}: {
  visible: boolean;
  memberName: string;
  blocked: boolean;
  onClose: () => void;
  onMute: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  t: MrTokens;
}) {
  return (
    <MrBottomSheet onClose={onClose} t={t} visible={visible}>
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
      {blocked ? (
        <Pressable
          onPress={onUnblock}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 20,
            paddingVertical: 16,
          }}
        >
          <Icon.check color={t.primary} size={20} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: t.primary }}>
            차단 해제
          </Text>
        </Pressable>
      ) : (
        <>
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
        </>
      )}
    </MrBottomSheet>
  );
}
