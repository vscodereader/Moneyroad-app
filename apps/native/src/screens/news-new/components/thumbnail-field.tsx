import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icons";
import {
  PhotoGridPicker,
  type PickedPhoto,
} from "@/screens/discussion-room/components/photo-grid-picker";
import type { MrTokens } from "@/utils/theme";

/* ----(관리자 뉴스 작성 폼의 썸네일 첨부 칸 — docs/rfcs/0006 §5-1)---- */
// 사진은 여기서 "고르기만" 한다. 실제 업로드는 폼 저장 시점에 화면이 한다
// (news-new/index.tsx). 편집 모드에서는 이미 서버에 있는 썸네일(remote)이
// 프리필되므로, 새로 고른 사진(local)과 구분해서 들고 다녀야 한다.
export type ThumbnailValue =
  | { kind: "remote"; url: string }
  | { kind: "local"; uri: string; name: string; mime: string; size: number };

const PREVIEW_SIZE = 56;
const PREVIEW_RADIUS = 8;
const SINGLE_PHOTO = 1;

// 편집 모드의 기존 썸네일은 원래 파일명을 알 수 없다(서버가 UUID로 저장한다).
// URL 끝 조각이라도 보여 줘야 "무엇이 붙어 있는지"가 구분된다.
function displayNameOf(value: ThumbnailValue): string {
  if (value.kind === "local") {
    return value.name;
  }
  const last = value.url.split("/").pop();
  return last && last.length > 0 ? last : "현재 썸네일";
}

function previewUriOf(value: ThumbnailValue): string {
  return value.kind === "local" ? value.uri : value.url;
}

// 미선택 상태: 큼직한 선택 버튼 + 기본 이미지 안내.
function EmptyState({ onPick, t }: { onPick: () => void; t: MrTokens }) {
  return (
    <>
      <Pressable
        onPress={onPick}
        style={{
          marginTop: 8,
          height: 48,
          borderRadius: 10,
          backgroundColor: t.bgSubtle,
          borderWidth: 1,
          borderColor: t.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <Icon.image color={t.fgMuted} size={18} />
        <Text style={{ fontSize: 14, fontWeight: "700", color: t.fgMuted }}>
          사진 선택
        </Text>
      </Pressable>
      <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 4 }}>
        선택하지 않으면 머니로드 기본 이미지가 들어갑니다.
      </Text>
    </>
  );
}

// 선택 상태: 미리보기 + 파일 이름 + 해제(✕) + 교체 버튼.
function SelectedState({
  value,
  onPick,
  onClear,
  t,
}: {
  value: ThumbnailValue;
  onPick: () => void;
  onClear: () => void;
  t: MrTokens;
}) {
  return (
    <View
      style={{
        marginTop: 8,
        backgroundColor: t.bgSubtle,
        borderRadius: 10,
        padding: 10,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image
          contentFit="cover"
          source={{ uri: previewUriOf(value) }}
          style={{
            width: PREVIEW_SIZE,
            height: PREVIEW_SIZE,
            borderRadius: PREVIEW_RADIUS,
            backgroundColor: t.bgMuted,
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: "600",
            color: t.fgStrong,
          }}
        >
          {displayNameOf(value)}
        </Text>
        <Pressable hitSlop={8} onPress={onClear} style={{ padding: 4 }}>
          <Icon.close color={t.fgMuted} size={18} />
        </Pressable>
      </View>
      <Pressable
        onPress={onPick}
        style={{
          height: 36,
          borderRadius: PREVIEW_RADIUS,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderColor: t.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: "700", color: t.fgMuted }}>
          사진 변경
        </Text>
      </Pressable>
    </View>
  );
}

export function ThumbnailField({
  value,
  onChange,
  t,
}: {
  value: ThumbnailValue | null;
  onChange: (next: ThumbnailValue | null) => void;
  t: MrTokens;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleConfirm = (photos: PickedPhoto[]) => {
    setPickerOpen(false);
    // 단일 선택 모드라 항상 0~1장이다. 0장이면(완료 버튼이 막혀 있어 실제로는
    // 오지 않지만) 기존 선택을 건드리지 않는다.
    const [photo] = photos;
    if (!photo) {
      return;
    }
    onChange({
      kind: "local",
      uri: photo.uri,
      name: photo.name,
      mime: photo.mime,
      size: photo.size,
    });
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
      <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
        썸네일 (선택)
      </Text>
      {value ? (
        <SelectedState
          onClear={() => onChange(null)}
          onPick={() => setPickerOpen(true)}
          t={t}
          value={value}
        />
      ) : (
        <EmptyState onPick={() => setPickerOpen(true)} t={t} />
      )}
      <PhotoGridPicker
        maxCount={SINGLE_PHOTO}
        onClose={() => setPickerOpen(false)}
        onConfirm={handleConfirm}
        t={t}
        visible={pickerOpen}
      />
    </View>
  );
}
/* ----(~관리자 뉴스 작성 폼의 썸네일 첨부 칸 여기까지)---- */
