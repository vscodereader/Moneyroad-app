import { Image } from "expo-image";
import { View } from "react-native";

import { mediaSource } from "@/lib/chat-upload";
import type { MrTokens } from "@/utils/theme";

// image 메시지 말풍선: expo-image 썸네일 그리드 (docs/rfcs/0004 기능5).
// n×n 규칙: 1→1×1, 4→2×2, 그 외 행당 최대 3개씩 채운다.
//   5→[3,2], 6→[3,3], 7→[3,3,1], 8→[3,3,2].

export type BubbleImage = { imageId: number; url: string };

const GRID_WIDTH = 232;
const GAP = 3;
const MAX_PER_ROW = 3;
const CELL = (GRID_WIDTH - GAP * (MAX_PER_ROW - 1)) / MAX_PER_ROW;
const SINGLE = CELL * 2 + GAP;

// Split n images into per-row counts.
function rowsFor(n: number): number[] {
  if (n <= 1) {
    return [Math.max(1, n)];
  }
  if (n === 4) {
    return [2, 2];
  }
  const rows: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    const take = Math.min(MAX_PER_ROW, remaining);
    rows.push(take);
    remaining -= take;
  }
  return rows;
}

export function ImageGridBubble({
  images,
  t,
}: {
  images: BubbleImage[];
  t: MrTokens;
}) {
  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    return (
      <Image
        contentFit="cover"
        source={mediaSource(images[0].url)}
        style={{
          width: SINGLE,
          height: SINGLE,
          borderRadius: 10,
          backgroundColor: t.bgMuted,
        }}
      />
    );
  }

  const rows = rowsFor(images.length);
  let cursor = 0;

  return (
    <View style={{ width: GRID_WIDTH, gap: GAP }}>
      {rows.map((count) => {
        const slice = images.slice(cursor, cursor + count);
        cursor += count;
        const rowKey = slice.map((im) => im.imageId).join("-");
        return (
          <View key={rowKey} style={{ flexDirection: "row", gap: GAP }}>
            {slice.map((im) => (
              <Image
                contentFit="cover"
                key={im.imageId}
                source={mediaSource(im.url)}
                style={{
                  flex: 1,
                  height: CELL,
                  borderRadius: 8,
                  backgroundColor: t.bgMuted,
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}
