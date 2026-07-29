import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

/* ----(답글 인용 블록 — RFC 0008 §4-6)---- */
// 텔레그램 방식(chat_and_answer_finish.jpg)을 따른다: 세로 색막대 + 작성자명 +
// 원문 한 줄. 카카오 방식("~에게 답장" 헤더)은 줄을 통째로 하나 더 먹는데
// 말풍선 폭이 좁아 세로 공간이 아깝고, 색막대가 원글/답글 경계를 더 분명히
// 보여준다.
//
// 같은 컴포넌트를 두 곳에서 쓴다:
//   ① 입력창 위 미리보기 (chat_and_answer2.jpg) — onCancel 을 준다
//   ② 말풍선 안 인용      (chat_and_answer_finish.jpg) — onPress 로 원문 점프(D16)

export interface ReplyParent {
  content: string | null;
  fileName: string | null;
  id: number;
  // 원문이 삭제/가림되면 서버가 본문을 비우고 이 값만 내려준다.
  masked: "deleted" | "blinded" | null;
  type: "text" | "image" | "file";
  userName: string;
}

/** 인용 한 줄에 쓸 문구. 첨부는 본문이 비어 있을 수 있다(D8). */
export function quotePreviewText(parent: ReplyParent): string {
  if (parent.masked === "deleted") {
    return "삭제된 글입니다";
  }
  if (parent.masked === "blinded") {
    return "가려진 글입니다";
  }
  if (parent.type === "image") {
    return "사진";
  }
  if (parent.type === "file") {
    return parent.fileName ? `파일 · ${parent.fileName}` : "파일";
  }
  return parent.content ?? "";
}

export function ReplyQuote({
  parent,
  t,
  onCancel,
  onPress,
  compact,
}: {
  parent: ReplyParent;
  t: MrTokens;
  /** 주면 우측에 ✕ 가 붙는다 (입력창 위 미리보기). */
  onCancel?: () => void;
  /** 주면 눌러서 원문으로 점프한다 (말풍선 안 인용, D16). */
  onPress?: () => void;
  /** 말풍선 안에서 쓸 때 여백을 줄인다. */
  compact?: boolean;
}) {
  const masked = parent.masked !== null;
  const body = quotePreviewText(parent);

  const inner = (
    <View style={{ flexDirection: "row", gap: 8, flex: 1 }}>
      <View
        style={{
          width: 3,
          borderRadius: 2,
          backgroundColor: masked ? t.borderStrong : t.primary,
        }}
      />
      <View style={{ flex: 1, gap: 1 }}>
        {masked ? null : (
          <Text
            numberOfLines={1}
            style={{ fontSize: 12, fontWeight: "700", color: t.primary }}
          >
            {parent.userName}
          </Text>
        )}
        <Text
          numberOfLines={1}
          style={{
            fontSize: 12,
            color: t.fgMuted,
            fontStyle: masked ? "italic" : "normal",
          }}
        >
          {body}
        </Text>
      </View>
    </View>
  );

  const padding = compact
    ? { paddingHorizontal: 0, paddingVertical: 2 }
    : { paddingHorizontal: 12, paddingVertical: 8 };

  if (onCancel) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: t.bgSubtle,
          borderTopWidth: 1,
          borderTopColor: t.border,
          ...padding,
        }}
      >
        {inner}
        <Pressable
          accessibilityLabel="답글 취소"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onCancel}
        >
          <Icon.close color={t.fgSubtle} size={18} />
        </Pressable>
      </View>
    );
  }

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={padding}>
        {inner}
      </Pressable>
    );
  }

  return <View style={padding}>{inner}</View>;
}
/* ----(~답글 인용 블록 여기까지)---- */
