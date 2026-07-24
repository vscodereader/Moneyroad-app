import { Text, View } from "react-native";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

// file 메시지 말풍선 (docs/rfcs/0004 기능5). 이름·크기를 보여주고, 탭 처리는
// 상위 Pressable(open via Linking)이 담당한다. 여긴 표현만.

export type BubbleFile = {
  url: string;
  name: string;
  mime: string;
  size: number;
};

const MB = 1024 * 1024;
const KB = 1024;

function fmtSize(bytes: number): string {
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  }
  if (bytes >= KB) {
    return `${Math.round(bytes / KB)} KB`;
  }
  return `${bytes} B`;
}

export function FileBubble({
  file,
  isSelf,
  t,
}: {
  file: BubbleFile;
  isSelf: boolean;
  t: MrTokens;
}) {
  const bg = isSelf ? t.primary : t.bg;
  const nameColor = isSelf ? "#fff" : t.fgStrong;
  const metaColor = isSelf ? "rgba(255,255,255,0.8)" : t.fgSubtle;
  const iconColor = isSelf ? "#fff" : t.primary;
  const iconBg = isSelf ? "rgba(255,255,255,0.18)" : t.primarySubtle;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        maxWidth: 240,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: bg,
        borderWidth: isSelf ? 0 : 1,
        borderColor: t.border,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: iconBg,
        }}
      >
        <Icon.file color={iconColor} size={18} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "700", color: nameColor }}
        >
          {file.name}
        </Text>
        <Text style={{ fontSize: 11, color: metaColor, marginTop: 2 }}>
          {fmtSize(file.size)}
        </Text>
      </View>
    </View>
  );
}
