import { Image } from "expo-image";
import { Pressable, View } from "react-native";

import { mediaSource } from "@/lib/discussion-upload";
import type { MrTokens } from "@/utils/theme";

// image 메시지 말풍선: expo-image 썸네일 그리드 (docs/rfcs/0004 기능5).
// n×n 규칙: 1→1×1, 4→2×2, 그 외 행당 최대 3개씩 채운다.
//   5→[3,2], 6→[3,3], 7→[3,3,1], 8→[3,3,2].
// 셀 탭 → 전체화면 뷰어(부모가 index로 연다).

export type BubbleImage = { imageId: number; url: string; mime: string };

const GRID_WIDTH = 232;
const GAP = 3;
const MAX_PER_ROW = 3;
const CELL = (GRID_WIDTH - GAP * (MAX_PER_ROW - 1)) / MAX_PER_ROW;
const SINGLE = CELL * 2 + GAP;

/* ----(뷰어 진입 접근성 라벨 — RFC 0005)---- */
// 스크린리더가 어느 사진을 여는지 읽어 줄 수 있게 순번을 붙인다. 한 장뿐이면
// 순번이 알려 주는 게 없어 생략한다.
function viewerLabel(index: number, total: number): string {
  return total > 1 ? `사진 ${index + 1}번 크게 보기` : "사진 크게 보기";
}
/* ----(~뷰어 진입 접근성 라벨 여기까지)---- */

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
  onPressImage,
  t,
}: {
  images: BubbleImage[];
  /* ----(이미지 탭 → 전체화면 뷰어)---- */
  onPressImage: (index: number) => void;
  /* ----(~이미지 탭 → 전체화면 뷰어 여기까지)---- */
  t: MrTokens;
}) {
  if (images.length === 0) {
    return null;
  }

  if (images.length === 1) {
    return (
      <Pressable
        accessibilityLabel={viewerLabel(0, images.length)}
        accessibilityRole="button"
        onPress={() => onPressImage(0)}
      >
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
      </Pressable>
    );
  }

  const rows = rowsFor(images.length);
  let cursor = 0;

  return (
    <View style={{ width: GRID_WIDTH, gap: GAP }}>
      {rows.map((count) => {
        const start = cursor;
        const slice = images.slice(cursor, cursor + count);
        cursor += count;
        const rowKey = slice.map((im) => im.imageId).join("-");
        return (
          <View key={rowKey} style={{ flexDirection: "row", gap: GAP }}>
            {slice.map((im, offset) => (
              <Pressable
                accessibilityLabel={viewerLabel(start + offset, images.length)}
                accessibilityRole="button"
                key={im.imageId}
                onPress={() => onPressImage(start + offset)}
                style={{ flex: 1 }}
              >
                <Image
                  contentFit="cover"
                  source={mediaSource(im.url)}
                  style={{
                    width: "100%",
                    height: CELL,
                    borderRadius: 8,
                    backgroundColor: t.bgMuted,
                  }}
                />
              </Pressable>
            ))}
          </View>
        );
      })}
    </View>
  );
}
