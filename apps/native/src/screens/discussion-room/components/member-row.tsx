import { Pressable, Text, View } from "react-native";

import { Tag } from "@/components/ui";
import type { MrTokens } from "@/utils/theme";

// 멤버 시트 한 줄에 필요한 최소 필드(discussion.roomMembers 출력의 부분집합).
export type RoomMember = {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
  mutedUntil: string | null;
  blocked: boolean;
};

// index.tsx의 아바타 색 해시와 동일 규칙(색을 이름 기준으로 안정적으로 배정).
const AVATAR_PALETTE = [
  "#256EF4",
  "#6A4DD6",
  "#198043",
  "#C97A0A",
  "#D6212F",
  "#0064B0",
  "#39506C",
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    // biome-ignore lint/suspicious/noBitwiseOperators: 32-bit integer hash
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function MemberAvatar({ name }: { name: string }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        backgroundColor: colorFor(name),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
        {name.slice(0, 1)}
      </Text>
    </View>
  );
}

function isMuted(mutedUntil: string | null): boolean {
  return mutedUntil !== null && new Date(mutedUntil).getTime() > Date.now();
}

// 아바타 + 이름 + 역할/상태 태그. 롱프레스로 관리자 액션시트를 연다.
// 관리자 본인은 대상이 될 수 없으므로 롱프레스를 막는다.
export function MemberRow({
  member,
  onLongPress,
  t,
}: {
  member: RoomMember;
  onLongPress: (member: RoomMember) => void;
  t: MrTokens;
}) {
  const admin = member.role === "admin";
  const muted = isMuted(member.mutedUntil);
  return (
    <Pressable
      onLongPress={admin ? undefined : () => onLongPress(member)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}
    >
      <MemberAvatar name={member.name} />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: "700",
          color: t.fgStrong,
        }}
      >
        {member.name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {admin ? (
          <Tag bg={t.primarySubtle} color={t.primary} label="관리자" />
        ) : null}
        {muted ? <Tag bg={t.bgMuted} color={t.fgMuted} label="뮤트" /> : null}
        {member.blocked ? (
          <Tag bg={t.downBg} color={t.downStrong} label="차단" />
        ) : null}
      </View>
    </Pressable>
  );
}
