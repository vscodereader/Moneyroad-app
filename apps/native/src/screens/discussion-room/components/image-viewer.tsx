/* ----(전체화면 이미지 뷰어 + 갤러리 저장, RFC 0004 기능5 후속)---- */
import { Image } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import { saveImageToGallery } from "@/lib/discussion-download";
import { mediaSource } from "@/lib/discussion-upload";
import type { BubbleImage } from "./image-grid-bubble";

// 보낸 사진을 탭하면 열리는 전체화면 뷰어. 좌우로 넘겨보고, 우상단 ⋮ 메뉴에서
// 갤러리의 moneyroad 앨범에 저장한다(앨범명은 discussion-download.ts의
// GALLERY_ALBUM 하나로 관리 — iOS는 앨범 중첩이 안 돼 평면 이름을 쓴다).
// 뷰어는 테마와 무관하게 항상 검은 배경이라 색도 테마 토큰이 아닌 고정값을 쓴다.

const SCRIM = "rgba(0,0,0,0.55)";
const MENU_BG = "#2A2D31";
const ON_DARK = "#FFFFFF";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const YESTERDAY = 1;

// 자정 기준 시각. 두 날짜의 차이를 "몇 밤 전"으로 세려면 시각이 아니라 날짜
// 경계로 비교해야 한다 — 그래야 어제 23시 사진이 오늘 0시에도 "어제"다.
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function fmtClock(d: Date): string {
  const hour = d.getHours();
  const meridiem = hour < 12 ? "오전" : "오후";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${meridiem} ${hour12}:${minute}`;
}

// 헤더의 보낸 시각. 오늘/어제는 그렇게 부르고, 그보다 오래된 사진은 며칠 전인지
// 알 수 있게 날짜를 붙인다(해가 넘어갔으면 연도까지).
function fmtSentAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const clock = fmtClock(d);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(d)) / MS_PER_DAY);
  if (daysAgo === 0) {
    return `오늘 ${clock}`;
  }
  if (daysAgo === YESTERDAY) {
    return `어제 ${clock}`;
  }
  const date = `${d.getMonth() + 1}월 ${d.getDate()}일`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${date} ${clock}`;
  }
  return `${d.getFullYear()}년 ${date} ${clock}`;
}

function ViewerHeader({
  senderName,
  sentAt,
  topInset,
  onClose,
  onOpenMenu,
}: {
  senderName: string;
  sentAt: string;
  topInset: number;
  onClose: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <View
      style={{
        paddingTop: topInset + 6,
        paddingBottom: 10,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Pressable
        accessibilityLabel="닫기"
        accessibilityRole="button"
        hitSlop={10}
        onPress={onClose}
        style={{ padding: 4 }}
      >
        <Icon.chevLeft color="#fff" size={24} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
          {senderName}
        </Text>
        <Text
          style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}
        >
          {sentAt}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="더보기"
        accessibilityRole="button"
        hitSlop={10}
        onPress={onOpenMenu}
        style={{ padding: 4 }}
      >
        <Icon.moreVertical color="#fff" size={22} />
      </Pressable>
    </View>
  );
}

function SaveMenu({
  topInset,
  saving,
  onSave,
  onDismiss,
}: {
  topInset: number;
  saving: boolean;
  onSave: () => void;
  onDismiss: () => void;
}) {
  return (
    <>
      <Pressable
        accessibilityLabel="메뉴 닫기"
        accessibilityRole="button"
        onPress={onDismiss}
        style={{ position: "absolute", inset: 0 }}
      />
      <View
        style={{
          position: "absolute",
          top: topInset + 44,
          right: 10,
          minWidth: 200,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: MENU_BG,
        }}
      >
        <Pressable
          accessibilityLabel="갤러리에 저장"
          accessibilityRole="button"
          disabled={saving}
          onPress={onSave}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          {saving ? (
            <ActivityIndicator color={ON_DARK} size="small" />
          ) : (
            <Icon.download color={ON_DARK} size={20} />
          )}
          <Text style={{ fontSize: 14, fontWeight: "600", color: ON_DARK }}>
            갤러리에 저장
          </Text>
        </Pressable>
      </View>
    </>
  );
}

export function ImageViewer({
  visible,
  images,
  initialIndex,
  senderName,
  createdAt,
  onClose,
}: {
  visible: boolean;
  images: BubbleImage[];
  initialIndex: number;
  senderName: string;
  createdAt: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Reopening at a different thumbnail must land on that image.
  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      setMenuOpen(false);
    }
  }, [visible, initialIndex]);

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      setIndex(Math.min(Math.max(next, 0), images.length - 1));
    },
    [width, images.length]
  );

  const handleSave = useCallback(async () => {
    const target = images[index];
    if (!target) {
      return;
    }
    setSaving(true);
    try {
      // 저장 위치 문구는 lib이 만든다 — 사진 접근 범위에 따라 앨범에 못 넣고
      // 사진 보관함에만 들어갈 수 있어서 화면이 위치를 단정하면 안 된다.
      const { label } = await saveImageToGallery(
        target.url,
        target.imageId,
        target.mime
      );
      setMenuOpen(false);
      Alert.alert("저장 완료", `${label}에 저장했어요.`);
    } catch (err) {
      Alert.alert(
        "저장 실패",
        err instanceof Error ? err.message : "사진을 저장하지 못했어요."
      );
    } finally {
      setSaving(false);
    }
  }, [images, index]);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      visible={visible}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <ViewerHeader
          onClose={onClose}
          onOpenMenu={() => setMenuOpen(true)}
          senderName={senderName}
          sentAt={fmtSentAt(createdAt)}
          topInset={insets.top}
        />
        {images.length > 1 ? (
          <Text
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: "700",
              color: "#fff",
              paddingBottom: 6,
            }}
          >
            {index + 1} / {images.length}
          </Text>
        ) : null}
        <FlatList
          data={images}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          horizontal
          initialScrollIndex={initialIndex}
          keyExtractor={(item) => String(item.imageId)}
          onMomentumScrollEnd={onScrollEnd}
          pagingEnabled
          renderItem={({ item }) => (
            <View style={{ width, flex: 1, justifyContent: "center" }}>
              <Image
                contentFit="contain"
                source={mediaSource(item.url)}
                style={{ width, height: height * 0.7 }}
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        />
        {menuOpen ? (
          <View style={{ position: "absolute", inset: 0 }}>
            <View style={{ flex: 1, backgroundColor: SCRIM }} />
            <SaveMenu
              onDismiss={() => setMenuOpen(false)}
              onSave={handleSave}
              saving={saving}
              topInset={insets.top}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
/* ----(~전체화면 이미지 뷰어 + 갤러리 저장 여기까지)---- */
