import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NewsCard } from "@/components/cards";
import { Icon } from "@/components/icons";
import { Chip, MrHeader, MrScreen, StockLogo } from "@/components/ui";
import { useLiveQuote } from "@/hooks/use-live-quotes";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { type NewsTab, useNewsStream } from "@/hooks/use-news-stream";
import { authClient } from "@/lib/auth-client";
import { findStock, type NewsItem } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { nav } from "@/utils/nav";
import { orpc } from "@/utils/orpc";

const TABS: { k: NewsTab; l: string }[] = [
  { k: "watch", l: "관심 종목" },
  { k: "all", l: "전체" },
  { k: "market", l: "시장" },
  { k: "industry", l: "산업" },
  // ----(추가: 기업·해외 탭)----
  { k: "company", l: "기업" },
  { k: "global", l: "해외" },
  // ----(추가 끝)----
  { k: "policy", l: "정책" },
];

/**
 * 뉴스 상세의 종목 패널. 매칭된 종목의 실시간 시세(useLiveQuote)를 종목 상세와
 * 동일 포맷으로 보여주고, 탭하면 종목 상세로 이동한다(nav.openStock 관례).
 * 시세 tick이 아직 없거나 장 마감이면 문구로 폴백한다(패널은 유지).
 */
function NewsStockPanel({
  code,
  stockName,
  dummyStock,
  onOpen,
}: {
  code: string;
  stockName: string;
  dummyStock: ReturnType<typeof findStock>;
  onOpen: () => void;
}) {
  const { t } = useMrTheme();
  const live = useLiveQuote(code);
  const panelStyle = {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 12,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
  };
  const body = (
    <>
      {dummyStock ? <StockLogo size={40} stock={dummyStock} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}>
          {stockName}
        </Text>
        {live ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "800", color: t.fgStrong }}
            >
              {fmt.price(live.price)}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: changeColor(live.change, t),
              }}
            >
              {fmt.signedNum(live.change)} ({fmt.pct(live.changeRate)})
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: t.fgMuted }}>
            시세 정보는 준비 중입니다.
          </Text>
        )}
      </View>
    </>
  );
  if (!code) {
    return <View style={panelStyle}>{body}</View>;
  }
  return (
    <Pressable onPress={onOpen} style={panelStyle}>
      {body}
    </Pressable>
  );
}

function NewsSheet({
  newsId,
  onClose,
  seed,
  isAdmin,
}: {
  newsId: string;
  onClose: () => void;
  seed?: NewsItem;
  isAdmin: boolean;
}) {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const detail = useQuery(
    orpc.news.detail.queryOptions({ input: { id: newsId } })
  );
  // 바로 삭제(확인창 없음, RFC 0002 D8) → 목록 무효화 후 시트 닫기.
  const removeNews = useMutation(
    orpc.news.remove.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.news.feed.key() });
        onClose();
      },
    })
  );
  const d = detail.data;
  // 피드에서 연 경우 seed로 즉시 표시하고, 푸시 딥링크처럼 seed가 없으면 detail로 채운다.
  const title =
    seed?.title ?? d?.title ?? (detail.isLoading ? "불러오는 중…" : "");
  const source = seed?.source ?? d?.source ?? "뉴스";
  const time = seed?.time ?? d?.time ?? "";
  const ai = seed?.ai ?? d?.ai ?? "";
  const code = seed?.code ?? d?.stock?.code ?? "";
  const dummyStock = code ? findStock(code) : undefined;
  const stockName =
    dummyStock?.name ?? seed?.stockName ?? d?.stock?.name ?? null;
  const url = d?.url ?? null;
  const preview = d?.preview;

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
      />
      <View
        style={{
          backgroundColor: t.bg,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          maxHeight: "82%",
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 999,
            backgroundColor: t.borderStrong,
            alignSelf: "center",
            marginTop: 10,
          }}
        />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                height: 22,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: t.sigAi,
              }}
            >
              <Icon.sparkles color="#fff" size={11} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
                AI 요약
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: t.fgSubtle }}>
              머니로드가 요약함
            </Text>
            <Pressable
              hitSlop={8}
              onPress={onClose}
              style={{ marginLeft: "auto" }}
            >
              <Icon.close color={t.fgStrong} size={18} />
            </Pressable>
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: t.fgStrong,
              marginTop: 10,
              lineHeight: 25,
            }}
          >
            {title}
          </Text>
          <Text style={{ fontSize: 12, color: t.fgSubtle, marginTop: 4 }}>
            {source} · {time}
          </Text>

          <View
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              backgroundColor: t.bgSubtle,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: t.sigAi,
                letterSpacing: 0.3,
                marginBottom: 6,
              }}
            >
              핵심 요약
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 22, color: t.fgStrong }}>
              {ai}
            </Text>
          </View>

          {stockName ? (
            <NewsStockPanel
              code={code}
              dummyStock={dummyStock}
              onOpen={() => {
                onClose();
                nav.openStock(code);
              }}
              stockName={stockName}
            />
          ) : null}

          <Text
            style={{
              marginTop: 16,
              fontSize: 13,
              fontWeight: "700",
              color: t.fgStrong,
            }}
          >
            원문 미리보기
          </Text>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 22,
              color: t.fgMuted,
              marginTop: 6,
            }}
          >
            {preview ??
              (detail.isLoading
                ? "원문을 불러오는 중…"
                : "원문 미리보기를 제공하지 않는 기사입니다. 아래에서 출처로 연결하세요.")}
          </Text>
          <Pressable
            disabled={!url}
            onPress={() => {
              if (url) {
                Linking.openURL(url);
              }
            }}
            style={{
              marginTop: 14,
              height: 44,
              borderRadius: 10,
              backgroundColor: url ? t.primary : t.borderStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
              원문 기사 보기
            </Text>
          </Pressable>

          {/* 관리자 + 수동(머니로드 독점) 기사에만 편집/삭제 노출 */}
          {isAdmin && d?.sourceType === "manual" ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => {
                  onClose();
                  nav.openEditNews(newsId);
                }}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: t.border,
                  backgroundColor: t.bgSubtle,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Icon.pencil color={t.fgStrong} size={16} />
                <Text
                  style={{ fontSize: 14, fontWeight: "800", color: t.fgStrong }}
                >
                  편집
                </Text>
              </Pressable>
              <Pressable
                onPress={() => removeNews.mutate({ id: newsId })}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: t.downBg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {removeNews.isPending ? (
                  <ActivityIndicator color={t.downStrong} size="small" />
                ) : (
                  <>
                    <Icon.trash color={t.downStrong} size={16} />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: t.downStrong,
                      }}
                    >
                      삭제
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const PAGE_SIZE = 5;

function EmptyState({ body, title }: { body: string; title: string }) {
  const { t } = useMrTheme();
  return (
    <View
      style={{
        paddingVertical: 64,
        paddingHorizontal: 24,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: t.fgStrong,
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: t.fgMuted,
          textAlign: "center",
          lineHeight: 18,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

function NewsTabs({
  tab,
  onChange,
}: {
  tab: NewsTab;
  onChange: (next: NewsTab) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 6,
        paddingVertical: 10,
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {TABS.map((c) => (
        <Chip
          active={tab === c.k}
          key={c.k}
          label={c.l}
          onPress={() => onChange(c.k)}
        />
      ))}
    </ScrollView>
  );
}

export default function NewsScreen() {
  const { t } = useMrTheme();
  const { data: session } = authClient.useSession();
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user.role === "admin";
  // 기본 탭: 로그인 상태면 관심 종목, 비로그인이면 전체. 세션이 처음 resolve될 때
  // 한 번만 시드해, 이후 사용자가 직접 탭을 바꾸면 그 선택을 유지한다.
  const [tab, setTab] = useState<NewsTab>("all");
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !session) {
      return;
    }
    if (isLoggedIn) {
      setTab("watch");
    }
    seededRef.current = true;
  }, [session, isLoggedIn]);
  const [openNews, setOpenNews] = useState<NewsItem | null>(null);
  // 푸시 등에서 newsId로 진입하면 해당 기사 시트를 자동으로 연다.
  const params = useLocalSearchParams<{ newsId?: string }>();
  const [deepLinkNewsId, setDeepLinkNewsId] = useState<string | null>(null);
  useEffect(() => {
    if (params.newsId) {
      setDeepLinkNewsId(params.newsId);
      // 소비 후 파라미터를 비워, 닫고 다시 들어와도 재오픈되지 않게 한다.
      router.setParams({ newsId: "" });
    }
  }, [params.newsId]);
  // 비로그인 + watch 탭이면 페치 차단 — ListEmptyComponent로 안내만 표시.
  const guestWatch = tab === "watch" && !isLoggedIn;
  const feed = useInfiniteQuery(
    orpc.news.feed.infiniteOptions({
      input: (cursor: string | undefined) => ({
        tab,
        cursor,
        limit: PAGE_SIZE,
      }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      enabled: !guestWatch,
    })
  );
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  // Live updates: refetch the feed when realtime pushes new news for this tab.
  useNewsStream(tab);

  const insets = useSafeAreaInsets();
  // Measured tab bar height (content scrolls under it); fall back to an estimate.
  const tabBarHeight =
    useContext(BottomTabBarHeightContext) ?? insets.bottom + 60;

  const loadMore = () => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) {
      feed.fetchNextPage();
    }
  };

  // Keep loading pages until the list is taller than the viewport; otherwise a
  // short first page (5 items) leaves nothing to scroll and onEndReached never
  // fires. After the screen fills, onEndReached takes over for further scroll.
  const listHeight = useRef(0);
  const contentHeight = useRef(0);
  const fillViewport = () => {
    if (
      listHeight.current > 0 &&
      contentHeight.current > 0 &&
      contentHeight.current <= listHeight.current
    ) {
      loadMore();
    }
  };

  return (
    <MrScreen>
      <MrHeader title="뉴스" />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={(() => {
          if (guestWatch) {
            return (
              <EmptyState
                body="로그인하면 관심 종목 뉴스를 모아 봅니다."
                title="로그인이 필요합니다"
              />
            );
          }
          if (feed.isLoading) {
            return (
              <View style={{ paddingVertical: 48, alignItems: "center" }}>
                <ActivityIndicator color={t.primary} />
              </View>
            );
          }
          return (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: t.fgSubtle }}>
                {tab === "watch"
                  ? "관심 종목 뉴스가 아직 없어요."
                  : "표시할 뉴스가 없어요."}
              </Text>
            </View>
          );
        })()}
        ListFooterComponent={
          // Spacer so the last card clears the tab bar (+ floating button).
          <View
            style={{ height: tabBarHeight + (feed.hasNextPage ? 56 : 16) }}
          />
        }
        ListHeaderComponent={<NewsTabs onChange={setTab} tab={tab} />}
        onContentSizeChange={(_w, h) => {
          contentHeight.current = h;
          fillViewport();
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        onLayout={(e) => {
          listHeight.current = e.nativeEvent.layout.height;
          fillViewport();
        }}
        renderItem={({ item }) => (
          <NewsCard news={item} onPress={() => setOpenNews(item)} showAiChip />
        )}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />

      {feed.hasNextPage && items.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: tabBarHeight - 50,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={loadMore}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 40,
              paddingHorizontal: 18,
              borderRadius: 999,
              backgroundColor: t.primary,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 5,
            }}
          >
            {feed.isFetchingNextPage ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text
                  style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}
                >
                  더 보기
                </Text>
                <Icon.arrowDown color="#fff" size={14} />
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {(() => {
        if (openNews) {
          return (
            <NewsSheet
              isAdmin={isAdmin}
              newsId={openNews.id}
              onClose={() => setOpenNews(null)}
              seed={openNews}
            />
          );
        }
        if (deepLinkNewsId) {
          return (
            <NewsSheet
              isAdmin={isAdmin}
              newsId={deepLinkNewsId}
              onClose={() => setDeepLinkNewsId(null)}
            />
          );
        }
        return null;
      })()}

      {isAdmin ? (
        <Pressable
          onPress={nav.openCreateNews}
          style={{
            position: "absolute",
            right: 16,
            bottom: tabBarHeight + 12,
            width: 52,
            height: 52,
            borderRadius: 999,
            backgroundColor: t.primary,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: t.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Icon.plus color="#fff" size={24} />
        </Pressable>
      ) : null}
    </MrScreen>
  );
}
