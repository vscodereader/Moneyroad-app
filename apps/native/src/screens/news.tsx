import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AiBriefCard, NewsCard } from "@/components/cards";
import { Icon } from "@/components/icons";
import {
  Chip,
  MrHeader,
  MrScreen,
  ScorePill,
  StockLogo,
} from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { findStock, type NewsItem, news, stocks } from "@/utils/data";
import { changeColor, fmt } from "@/utils/format";

type NewsTab = "watch" | "all" | "industry" | "market" | "policy";

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
  const stock = findStock(item.code);
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

          {stock ? (
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
              <StockLogo size={40} stock={stock} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: t.fgStrong }}
                >
                  {stock.name}
                </Text>
                <Text style={{ fontSize: 12, color: t.fgMuted }}>
                  {fmt.price(stock.price)}원 ·{" "}
                  <Text style={{ color: changeColor(stock.change, t) }}>
                    {fmt.pct(stock.changePct)}
                  </Text>
                </Text>
              </View>
              <ScorePill score={stock.score} />
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
            {item.source}에 따르면, 관련 업계 관계자와 시장 전문가의 분석을
            종합한 결과 단기 모멘텀과 중기 펀더멘털 양면에서 의미 있는 변화가
            관측되고 있다. 머니로드는 원문을 가공하지 않고 출처 사이트로
            연결한다.
          </Text>
          <Pressable
            style={{
              marginTop: 14,
              height: 44,
              borderRadius: 10,
              backgroundColor: t.primary,
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

export default function NewsScreen() {
  const [tab, setTab] = useState<NewsTab>("watch");
  const [openNews, setOpenNews] = useState<NewsItem | null>(null);
  const watchedCodes = new Set(
    stocks.filter((s) => s.watched).map((s) => s.code)
  );
  const list =
    tab === "watch" ? news.filter((n) => watchedCodes.has(n.code)) : news;

  return (
    <MrScreen>
      <MrHeader title="뉴스" />
      <ScrollView showsVerticalScrollIndicator={false}>
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
              onPress={() => setTab(c.k)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
          <AiBriefCard
            body="관심 종목 6건 중 4건이 긍정 이벤트. 두산에너빌리티 체코 원전 본계약과 SK하이닉스 HBM4 양산 일정 단축이 오늘의 핵심."
            onMore={() => setOpenNews(news[1])}
            time="오전 7:30 업데이트"
          />
        </View>

        {list.map((n) => (
          <NewsCard
            key={n.id}
            news={n}
            onPress={() => setOpenNews(n)}
            showAiChip
          />
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      {openNews ? (
        <NewsSheet item={openNews} onClose={() => setOpenNews(null)} />
      ) : null}
    </MrScreen>
  );
}
