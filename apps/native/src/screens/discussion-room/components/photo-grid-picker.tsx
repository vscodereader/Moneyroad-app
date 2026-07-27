import { File } from "expo-file-system";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icons";
import type { MrTokens } from "@/utils/theme";

// 앱 내부 커스텀 사진 그리드(시스템 피커 아님, docs/rfcs/0004 기능5).
// 권한 → 최근 사진 조회 → 다중선택(최대 8, 선택순번 배지, 원본 합계 ≤10MB).
// 확정 시 업로드 가능한 로컬 파일 목록을 onConfirm으로 넘긴다.

export type PickedPhoto = {
  id: string;
  // Upload/size source — a readable file:// uri (see readableUriOf).
  uri: string;
  // Grid-thumbnail source (asset.uri: ph:// on iOS, file:// on Android).
  thumbUri: string;
  name: string;
  mime: string;
  size: number;
};

const MAX_IMAGES = 8;
const MB = 1024 * 1024;
const MAX_TOTAL_BYTES = 10 * MB;
const RECENT_LIMIT = 120;
const COLS = 4;
const GAP = 2;
const NOTICE_MS = 2200;

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function mimeFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "image/jpeg";
}

/* ----(앨범 자산의 읽을 수 있는 로컬 경로 — RFC 0005 §5)---- */
// Readable file:// path for an asset, without asking the library for full info.
// Android already hands back a file:// uri, and its getAssetInfoAsync always
// resolves with full info — which reads the photo's EXIF GPS through
// MediaStore.setRequireOriginal() and throws without ACCESS_MEDIA_LOCATION, a
// permission this app deliberately doesn't request (RFC 0004 §204; the server
// strips EXIF anyway). So Android must never reach that call at all: the gate
// is the platform, not the uri shape — a uri that isn't file:// (a scheme a
// future OS version may hand back) would otherwise fall straight into it and
// bring the reject back. Only iOS returns a ph:// reference to resolve.
async function readableUriOf(asset: MediaLibrary.Asset): Promise<string> {
  if (Platform.OS === "android" || asset.uri.startsWith("file://")) {
    return asset.uri;
  }
  const info = await MediaLibrary.getAssetInfoAsync(asset);
  return info?.localUri ?? asset.uri;
}
/* ----(~앨범 자산의 읽을 수 있는 로컬 경로 여기까지)---- */

function fmtSize(bytes: number): string {
  if (bytes >= MB) {
    return `${(bytes / MB).toFixed(1)}MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function PickerHeader({
  count,
  totalBytes,
  onClose,
  onConfirm,
  topInset,
  t,
}: {
  count: number;
  totalBytes: number;
  onClose: () => void;
  onConfirm: () => void;
  topInset: number;
  t: MrTokens;
}) {
  const canConfirm = count > 0;
  return (
    <View
      style={{
        paddingTop: topInset + 8,
        paddingBottom: 10,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: t.bg,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <Pressable hitSlop={8} onPress={onClose} style={{ padding: 4 }}>
        <Icon.close color={t.fgStrong} size={22} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: t.fgStrong }}>
          사진 선택
        </Text>
        <Text style={{ fontSize: 11, color: t.fgMuted, marginTop: 1 }}>
          {count}/{MAX_IMAGES} · {fmtSize(totalBytes)} / 10MB
        </Text>
      </View>
      <Pressable
        disabled={!canConfirm}
        hitSlop={8}
        onPress={onConfirm}
        style={{
          paddingHorizontal: 16,
          height: 36,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: canConfirm ? t.primary : t.bgMuted,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "800",
            color: canConfirm ? "#fff" : t.fgSubtle,
          }}
        >
          완료
        </Text>
      </Pressable>
    </View>
  );
}

function PermissionDenied({
  onClose,
  onRetry,
  t,
}: {
  onClose: () => void;
  onRetry: () => void;
  t: MrTokens;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        gap: 8,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: "800",
          color: t.fgStrong,
          textAlign: "center",
        }}
      >
        사진 접근 권한이 필요해요
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: t.fgMuted,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        앨범에서 사진을 첨부하려면 권한을 허용해 주세요. 설정에서 언제든 바꿀 수
        있어요.
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Pressable
          onPress={onClose}
          style={{
            paddingHorizontal: 18,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: t.fgMuted }}>
            닫기
          </Text>
        </Pressable>
        <Pressable
          onPress={onRetry}
          style={{
            paddingHorizontal: 18,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.primary,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
            설정 열기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GridCell({
  asset,
  order,
  cell,
  onToggle,
  t,
}: {
  asset: MediaLibrary.Asset;
  order: number;
  cell: number;
  onToggle: (asset: MediaLibrary.Asset) => void;
  t: MrTokens;
}) {
  const selected = order > 0;
  return (
    <Pressable
      onPress={() => onToggle(asset)}
      style={{ width: cell, height: cell, padding: GAP / 2 }}
    >
      <View style={{ flex: 1, borderRadius: 4, overflow: "hidden" }}>
        <Image
          contentFit="cover"
          source={{ uri: asset.uri }}
          style={{ width: "100%", height: "100%" }}
        />
        {selected ? (
          <View
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(37,110,244,0.28)",
              borderWidth: 2,
              borderColor: t.primary,
              borderRadius: 4,
            }}
          />
        ) : null}
        <View
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            width: 20,
            height: 20,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: selected ? t.primary : "rgba(255,255,255,0.9)",
            backgroundColor: selected ? t.primary : "rgba(0,0,0,0.25)",
          }}
        >
          {selected ? (
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>
              {order}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function PhotoGridPicker({
  visible,
  onClose,
  onConfirm,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (photos: PickedPhoto[]) => void;
  t: MrTokens;
}) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<PickedPhoto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const cell = Math.floor(Dimensions.get("window").width / COLS);
  const totalBytes = selected.reduce((sum, p) => sum + p.size, 0);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  // Reset selection each time the picker opens.
  useEffect(() => {
    if (visible) {
      setSelected([]);
      setNotice(null);
    }
  }, [visible]);

  // Request permission when opened without one yet.
  useEffect(() => {
    if (
      visible &&
      permission &&
      !permission.granted &&
      permission.canAskAgain
    ) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // Load recent photos once granted.
  useEffect(() => {
    if (!(visible && permission?.granted)) {
      return;
    }
    let active = true;
    setLoading(true);
    MediaLibrary.getAssetsAsync({
      first: RECENT_LIMIT,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
    })
      .then((page) => {
        if (active) {
          setAssets(page.assets);
        }
      })
      .catch(() => {
        if (active) {
          flash("사진을 불러오지 못했어요.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [visible, permission?.granted, flash]);

  const toggle = useCallback(
    async (asset: MediaLibrary.Asset) => {
      const existing = selected.find((p) => p.id === asset.id);
      if (existing) {
        setSelected((prev) => prev.filter((p) => p.id !== asset.id));
        return;
      }
      if (selected.length >= MAX_IMAGES) {
        flash(`최대 ${MAX_IMAGES}장까지 선택할 수 있어요.`);
        return;
      }
      try {
        const uri = await readableUriOf(asset);
        let size = 0;
        try {
          size = new File(uri).size ?? 0;
        } catch {
          size = 0;
        }
        if (totalBytes + size > MAX_TOTAL_BYTES) {
          flash("원본 크기 합계가 10MB를 넘어요.");
          return;
        }
        const name = asset.filename || `image-${asset.id}.jpg`;
        setSelected((prev) => [
          ...prev,
          {
            id: asset.id,
            uri,
            thumbUri: asset.uri,
            name,
            mime: mimeFromName(name),
            size,
          },
        ]);
      } catch {
        flash("사진을 불러오지 못했어요.");
      }
    },
    [selected, totalBytes, flash]
  );

  const orderOf = useCallback(
    (id: string) => selected.findIndex((p) => p.id === id) + 1,
    [selected]
  );

  const denied = permission != null && !permission.granted;

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <PickerHeader
          count={selected.length}
          onClose={onClose}
          onConfirm={() => onConfirm(selected)}
          t={t}
          topInset={insets.top}
          totalBytes={totalBytes}
        />
        {notice ? (
          <View
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              backgroundColor: t.warningBg,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: t.warning }}>
              {notice}
            </Text>
          </View>
        ) : null}
        {denied ? (
          <PermissionDenied
            onClose={onClose}
            onRetry={() => {
              if (permission?.canAskAgain) {
                requestPermission();
              } else {
                Linking.openSettings();
              }
            }}
            t={t}
          />
        ) : loading ? (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <ActivityIndicator color={t.primary} />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
            data={assets}
            keyExtractor={(item) => item.id}
            numColumns={COLS}
            renderItem={({ item }) => (
              <GridCell
                asset={item}
                cell={cell}
                onToggle={toggle}
                order={orderOf(item.id)}
                t={t}
              />
            )}
          />
        )}
      </View>
    </Modal>
  );
}
