import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

// file 메시지 말풍선 (docs/rfcs/0004 기능5, 저장·열기는 docs/rfcs/0005).
// 왼쪽 원형 버튼은 아직 저장 전이면 저장을, 저장된 뒤엔 열기를 맡는다.
// 이름 영역 탭은 상위 Pressable이 처리한다(미저장이면 캐시로 받아서, 저장됐으면
// 그 저장본을 폰에 설치된 앱으로 연다).

export type BubbleFile = {
  url: string;
  name: string;
  mime: string;
  size: number;
};

/* ----("여는 중" 상태 추가 — RFC 0005 §4-3)---- */
// opening: 저장본이 없어 앱 캐시로 받는 동안(수 초 걸릴 수 있다). 저장 폴더에는
// 남지 않으므로 끝나면 원래 상태(idle/saved)로 돌아간다.
export type FileSaveState = "idle" | "downloading" | "opening" | "saved";
/* ----(~"여는 중" 상태 추가 여기까지)---- */

const MB = 1024 * 1024;
const KB = 1024;
const DISC = 38;

function fmtSize(bytes: number): string {
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)} MB`;
  }
  if (bytes >= KB) {
    return `${Math.round(bytes / KB)} KB`;
  }
  return `${bytes} B`;
}

// 진행 중(저장/열기)에는 원형 버튼을 잠그고 스피너를 돌린다.
function isBusyState(state: FileSaveState): boolean {
  return state === "downloading" || state === "opening";
}

function metaText(state: FileSaveState, size: number): string {
  if (state === "downloading") {
    return "저장 중…";
  }
  /* ----(여는 중 표시)---- */
  if (state === "opening") {
    return "여는 중…";
  }
  /* ----(~여는 중 표시 여기까지)---- */
  if (state === "saved") {
    return `${fmtSize(size)} · 저장됨`;
  }
  return fmtSize(size);
}

function DiscIcon({
  state,
  color,
  background,
}: {
  state: FileSaveState;
  color: string;
  background: string;
}) {
  return (
    <View
      style={{
        width: DISC,
        height: DISC,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background,
      }}
    >
      {isBusyState(state) ? <ActivityIndicator color={color} /> : null}
      {state === "idle" ? <Icon.download color={color} size={19} /> : null}
      {state === "saved" ? <Icon.file color={color} size={19} /> : null}
    </View>
  );
}

export function FileBubble({
  file,
  isSelf,
  state,
  onDownload,
  onOpen,
  t,
}: {
  file: BubbleFile;
  isSelf: boolean;
  state: FileSaveState;
  onDownload: () => void;
  /* ----(저장된 뒤엔 원형 버튼이 열기를 맡는다)---- */
  onOpen: () => void;
  /* ----(~저장된 뒤엔 원형 버튼이 열기를 맡는다 여기까지)---- */
  t: MrTokens;
}) {
  const bg = isSelf ? t.primary : t.bg;
  const nameColor = isSelf ? "#fff" : t.fgStrong;
  const metaColor = isSelf ? "rgba(255,255,255,0.8)" : t.fgSubtle;
  const iconColor = isSelf ? t.primary : "#fff";
  const discBg = isSelf ? "#fff" : t.primary;
  /* ----(원형 버튼 동작: 저장 전 = 저장, 저장 후 = 열기)---- */
  // 진행 중일 때만 잠근다. 저장이 끝난 뒤에도 계속 잠가 두면 버튼이 영영 죽는다.
  const isSaved = state === "saved";
  const isBusy = isBusyState(state);
  /* ----(~원형 버튼 동작 여기까지)---- */

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
      <Pressable
        accessibilityLabel={isSaved ? "저장된 파일 열기" : "파일 저장"}
        accessibilityRole="button"
        disabled={isBusy}
        hitSlop={6}
        onPress={isSaved ? onOpen : onDownload}
      >
        <DiscIcon background={discBg} color={iconColor} state={state} />
      </Pressable>
      <View style={{ flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 13, fontWeight: "700", color: nameColor }}
        >
          {file.name}
        </Text>
        <Text style={{ fontSize: 11, color: metaColor, marginTop: 2 }}>
          {metaText(state, file.size)}
        </Text>
      </View>
    </View>
  );
}
