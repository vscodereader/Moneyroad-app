import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Href, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton, MrScreen, Switch } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { uploadNewsThumbnail } from "@/lib/news-thumbnail-upload";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";
import {
  ThumbnailField,
  type ThumbnailValue,
} from "./components/thumbnail-field";

// 저장 카테고리 값(탭 id와 다름): 시장/산업/기업/해외/정책 → market/sector/company/global/other
type NewsCategoryValue = "market" | "sector" | "company" | "global" | "other";

const CATEGORY_OPTIONS: { value: NewsCategoryValue; label: string }[] = [
  { value: "market", label: "시장" },
  { value: "sector", label: "산업" },
  { value: "company", label: "기업" },
  { value: "global", label: "해외" },
  { value: "other", label: "정책" },
];

const CATEGORY_VALUES = CATEGORY_OPTIONS.map((o) => o.value);

function isNewsCategory(value: string): value is NewsCategoryValue {
  return (CATEGORY_VALUES as readonly string[]).includes(value);
}

const TITLE_MAX = 120;
const CONTENT_MAX = 4000;

/* ----(썸네일: 저장 직전에 업로드해 URL로 바꾼다 — docs/rfcs/0006 §5-2)---- */
// 사진을 고르는 즉시가 아니라 [저장] 시점에 올리는 이유: 관리자가 작성을
// 도중에 취소하면 아무 기사도 참조하지 않는 고아 객체가 GCS에 남기 때문이다.
// 편집 모드에서 프리필된 기존 썸네일(remote)은 이미 올라가 있으니 그대로 쓴다.
// 아무것도 안 골랐으면 undefined → 서버가 null 저장 → 앱이 기본 이미지를 그린다.
async function resolveThumbnailUrl(
  value: ThumbnailValue | null
): Promise<string | undefined> {
  if (!value) {
    return;
  }
  if (value.kind === "remote") {
    return value.url;
  }
  return await uploadNewsThumbnail({
    uri: value.uri,
    name: value.name,
    mime: value.mime,
  });
}

function uploadFailMessage(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "썸네일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}
/* ----(~썸네일 업로드 여기까지)---- */

// 카테고리 다중 선택 토글(최소 1개). SegmentedControl은 단일선택이라 별도 구현.
function CategoryToggle({
  selected,
  onToggle,
  t,
}: {
  selected: NewsCategoryValue[];
  onToggle: (value: NewsCategoryValue) => void;
  t: MrTokens;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 8,
      }}
    >
      {CATEGORY_OPTIONS.map((opt) => {
        const on = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => onToggle(opt.value)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: on ? t.primary : t.bgSubtle,
              borderWidth: 1,
              borderColor: on ? t.primary : t.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: on ? "#fff" : t.fgMuted,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// 뉴스 작성/편집 폼 상태·검증·저장. newsId가 있으면 편집 모드.
function useNewsForm(newsId?: string) {
  const queryClient = useQueryClient();
  const isEdit = typeof newsId === "string" && newsId.length > 0;

  const [categories, setCategories] = useState<NewsCategoryValue[]>([]);
  const [pinned, setPinned] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [thumbnail, setThumbnail] = useState<ThumbnailValue | null>(null);
  // 업로드는 mutation 밖에서 일어나므로 저장 버튼 로딩을 따로 켜 줘야 한다.
  const [uploading, setUploading] = useState(false);

  // 편집 모드: 기존 기사 값을 불러와 프리필(생성 모드에선 비활성).
  const detailQuery = useQuery({
    ...orpc.news.detail.queryOptions({ input: { id: newsId ?? "" } }),
    enabled: isEdit,
  });
  const prefilledRef = useRef(false);

  useEffect(() => {
    if (!(isEdit && detailQuery.data) || prefilledRef.current) {
      return;
    }
    const d = detailQuery.data;
    prefilledRef.current = true;
    setCategories(d.categories.filter(isNewsCategory));
    setPinned(d.pinned);
    setTitle(d.title);
    setContent(d.content);
    setLink(d.url ?? "");
    // 이미 붙어 있는 썸네일은 다시 올릴 필요가 없다(remote). 교체·해제만 가능.
    setThumbnail(d.imageUrl ? { kind: "remote", url: d.imageUrl } : null);
  }, [isEdit, detailQuery.data]);

  const invalidateFeed = () => {
    queryClient.invalidateQueries({ queryKey: orpc.news.feed.key() });
  };
  const goToNews = () => {
    invalidateFeed();
    router.replace("/(moneyroad)/(tabs)/news" as Href);
  };

  const createNews = useMutation(
    orpc.news.create.mutationOptions({ onSuccess: goToNews })
  );
  const updateNews = useMutation(
    orpc.news.update.mutationOptions({ onSuccess: goToNews })
  );

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const trimmedLink = link.trim();
  // 저장 = 썸네일 업로드 + mutation. 둘 중 하나라도 진행 중이면 저장 중이다.
  const isPending =
    uploading || (isEdit ? updateNews.isPending : createNews.isPending);
  const isError = isEdit ? updateNews.isError : createNews.isError;
  const canSubmit =
    categories.length > 0 &&
    trimmedTitle.length > 0 &&
    trimmedContent.length > 0 &&
    !isPending;

  const toggleCategory = (value: NewsCategoryValue) => {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!canSubmit) {
      return;
    }
    // 업로드가 실패하면 기사를 만들지 않는다 — 썸네일만 빠진 채로 저장되면
    // 관리자는 성공한 줄 알고 화면을 떠난다.
    let thumbnailUrl: string | undefined;
    setUploading(true);
    try {
      thumbnailUrl = await resolveThumbnailUrl(thumbnail);
    } catch (err) {
      Alert.alert("썸네일 업로드 실패", uploadFailMessage(err));
      return;
    } finally {
      setUploading(false);
    }
    const payload = {
      categories,
      pinned,
      title: trimmedTitle,
      content: trimmedContent,
      link: trimmedLink.length > 0 ? trimmedLink : undefined,
      thumbnailUrl,
    };
    if (isEdit && typeof newsId === "string") {
      updateNews.mutate({ id: newsId, ...payload });
      return;
    }
    createNews.mutate(payload);
  };

  const handleCancel = () => {
    Alert.alert("정말 취소하시겠습니까?", "작성한 내용은 저장되지 않습니다.", [
      { text: "계속 작성", style: "cancel" },
      { text: "취소", style: "destructive", onPress: () => nav.back() },
    ]);
  };

  return {
    isEdit,
    categories,
    toggleCategory,
    pinned,
    setPinned,
    title,
    setTitle,
    content,
    setContent,
    link,
    setLink,
    thumbnail,
    setThumbnail,
    isPending,
    isError,
    canSubmit,
    handleSave,
    handleCancel,
  };
}

export default function NewsFormScreen({ newsId }: { newsId?: string }) {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const {
    isEdit,
    categories,
    toggleCategory,
    pinned,
    setPinned,
    title,
    setTitle,
    content,
    setContent,
    link,
    setLink,
    thumbnail,
    setThumbnail,
    isPending,
    isError,
    canSubmit,
    handleSave,
    handleCancel,
  } = useNewsForm(newsId);

  return (
    <MrScreen>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: t.bg,
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <BackButton onPress={nav.back} />
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: "800",
            color: t.fgStrong,
          }}
        >
          {isEdit ? "뉴스 편집" : "새 뉴스"}
        </Text>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={20}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Categories (multi, 최소 1개) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            카테고리 * (하나 이상)
          </Text>
          <CategoryToggle
            onToggle={toggleCategory}
            selected={categories}
            t={t}
          />
        </View>

        {/* Pinned */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}
              >
                최상단 고정
              </Text>
              <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 2 }}>
                선택한 카테고리 탭 맨 위에 📌 핀으로 고정합니다.
              </Text>
            </View>
            <Switch on={pinned} onChange={setPinned} />
          </View>
        </View>

        {/* Title */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            제목 *
          </Text>
          <TextInput
            maxLength={TITLE_MAX}
            onChangeText={setTitle}
            placeholder="예: 머니로드 단독 - 이번 주 시장 브리핑"
            placeholderTextColor={t.fgSubtle}
            style={{
              marginTop: 8,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: t.fgStrong,
              fontWeight: "600",
            }}
            value={title}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {title.length}/{TITLE_MAX}
          </Text>
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            내용 *
          </Text>
          <TextInput
            maxLength={CONTENT_MAX}
            multiline
            numberOfLines={8}
            onChangeText={setContent}
            placeholder="기사 본문을 입력하세요. 핵심 요약·원문 미리보기에 그대로 노출됩니다."
            placeholderTextColor={t.fgSubtle}
            style={{
              marginTop: 8,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: t.fgStrong,
              minHeight: 180,
              textAlignVertical: "top",
            }}
            value={content}
          />
          <Text
            style={{
              fontSize: 11,
              color: t.fgSubtle,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {content.length}/{CONTENT_MAX}
          </Text>
        </View>

        {/* Link (optional) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: t.fgMuted }}>
            원문 링크 (선택)
          </Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="url"
            onChangeText={setLink}
            placeholder="https://…"
            placeholderTextColor={t.fgSubtle}
            style={{
              marginTop: 8,
              backgroundColor: t.bgSubtle,
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              fontSize: 14,
              color: t.fgStrong,
            }}
            value={link}
          />
          <Text style={{ fontSize: 11, color: t.fgSubtle, marginTop: 4 }}>
            입력 시 상세의 "원문 기사 보기" 버튼이 이 링크로 연결됩니다.
          </Text>
        </View>

        {/* ----(썸네일 첨부 — docs/rfcs/0006 §5-1)---- */}
        <ThumbnailField onChange={setThumbnail} t={t} value={thumbnail} />
        {/* ----(~썸네일 첨부 여기까지)---- */}

        {/* Save / Cancel */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 24,
            flexDirection: "row",
            gap: 10,
          }}
        >
          <Pressable
            onPress={handleCancel}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.bgSubtle,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "800", color: t.fgMuted }}>
              취소
            </Text>
          </Pressable>
          <Pressable
            disabled={!canSubmit}
            onPress={handleSave}
            style={{
              flex: 2,
              height: 48,
              borderRadius: 12,
              backgroundColor: canSubmit ? t.primary : t.borderStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                저장
              </Text>
            )}
          </Pressable>
        </View>
        {isError ? (
          <Text
            style={{
              marginTop: 10,
              paddingHorizontal: 16,
              fontSize: 12,
              color: t.downStrong,
              textAlign: "center",
            }}
          >
            저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
          </Text>
        ) : null}
      </KeyboardAwareScrollView>
    </MrScreen>
  );
}
