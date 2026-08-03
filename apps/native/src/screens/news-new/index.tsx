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
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";
import type { MrTokens } from "@/utils/theme";

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
  const isPending = isEdit ? updateNews.isPending : createNews.isPending;
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

  const handleSave = () => {
    if (!canSubmit) {
      return;
    }
    const payload = {
      categories,
      pinned,
      title: trimmedTitle,
      content: trimmedContent,
      link: trimmedLink.length > 0 ? trimmedLink : undefined,
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
