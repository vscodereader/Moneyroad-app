import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import {
  Chip,
  MrHeader,
  MrScreen,
  ScorePill,
  StockLogo,
} from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { type NewsTab, useNewsStream } from "@/hooks/use-news-stream";
import { findStock, type NewsItem } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";
import { orpc } from "@/utils/orpc";

const TABS: { k: NewsTab; l: string }[] = [
  { k: "watch", l: "관심 종목" },
  { k: "all", l: "전체" },
  { k: "industry", l: "산업" },
  { k: "market", l: "시장" },
  { k: "policy", l: "정책" },
];

function NewsSheet({ item, onClose }: { item: NewsItem; onClose: () => void }) {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const detail = useQuery(
    orpc.news.detail.queryOptions({ input: { id: item.id } })
  );
  const dummyStock = findStock(item.code);
  const stockName = dummyStock?.name ?? item.stockName;
  const url = detail.data?.url ?? null;
  const preview = detail.data?.preview;

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
              Claude가 생성
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
            {item.title}
          </Text>
          <Text style={{ fontSize: 12, color: t.fgSubtle, marginTop: 4 }}>
            {item.source} · {item.time}
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
              {item.ai}
            </Text>
          </View>

          {stockName ? (
            <View
              style={{
                marginTop: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              {dummyStock ? <StockLogo size={40} stock={dummyStock} /> : null}
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}
                >
                  {stockName}
                </Text>
                {dummyStock ? (
                  <Text style={{ fontSize: 12, color: t.fgMuted }}>
                    {fmt.price(dummyStock.price)}원 ·{" "}
                    <Text style={{ color: changeColor(dummyStock.change, t) }}>
                      {fmt.pct(dummyStock.changePct)}
                    </Text>
                  </Text>
                ) : null}
              </View>
              {dummyStock ? <ScorePill score={dummyStock.score} /> : null}
            </View>
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const PAGE_SIZE = 5;

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
  const [tab, setTab] = useState<NewsTab>("watch");
  const [openNews, setOpenNews] = useState<NewsItem | null>(null);
  const feed = useInfiniteQuery(
    orpc.news.feed.infiniteOptions({
      input: (cursor: string | undefined) => ({
        tab,
        cursor,
        limit: PAGE_SIZE,
      }),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    })
  );
  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  // Live updates: refetch the feed when realtime pushes new news for this tab.
  useNewsStream(tab);

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
        ListEmptyComponent={
          feed.isLoading ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: t.fgSubtle }}>
                {tab === "watch"
                  ? "관심 종목 뉴스가 아직 없어요."
                  : "표시할 뉴스가 없어요."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={(() => {
          if (feed.isFetchingNextPage) {
            return (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={t.primary} />
              </View>
            );
          }
          if (feed.hasNextPage && items.length > 0) {
            return (
              <Pressable
                onPress={() => feed.fetchNextPage()}
                style={{ paddingVertical: 16, alignItems: "center" }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: t.primary }}
                >
                  더 보기
                </Text>
              </Pressable>
            );
          }
          return <View style={{ height: 16 }} />;
        })()}
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

      {openNews ? (
        <NewsSheet item={openNews} onClose={() => setOpenNews(null)} />
      ) : null}
    </MrScreen>
  );
}
