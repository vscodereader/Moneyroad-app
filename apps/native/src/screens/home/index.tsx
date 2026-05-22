import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  // AiBriefCard,
  IndexStrip,
  NewsCard,
  SignalCard,
  StockRow,
} from "@/components/cards";
import { Icon } from "@/components/icons";
import { IconButton, MrHeader, MrScreen, SectionHead } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { indices, news, signals, stocks } from "@/utils/data";
import { nav } from "@/utils/nav";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "좋은 아침이에요";
  }
  if (hour < 18) {
    return "오늘 시장도 함께 살펴봐요";
  }
  return "장 마감 후 정리해볼까요";
}

export default function HomeScreen() {
  const { t } = useMrTheme();
  const [openSigId, setOpenSigId] = useState<string | null>(null);
  const watched = stocks.filter((s) => s.watched);
  const topSignals = signals.slice(0, 3);
  const topNews = news.slice(0, 3);
  const watchedPreview = [...watched]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <MrScreen>
      <MrHeader
        right={
          <>
            <IconButton onPress={nav.openSearch}>
              <Icon.search color={t.fgStrong} size={22} />
            </IconButton>
            <IconButton dot onPress={nav.openAlerts}>
              <Icon.bell color={t.fgStrong} size={22} />
            </IconButton>
          </>
        }
        title={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: t.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon.logo color="#fff" size={18} />
            </View>
            <Text
              style={{
                fontSize: 19,
                fontWeight: "800",
                letterSpacing: -0.4,
                color: t.fgStrong,
              }}
            >
              머니<Text style={{ color: t.primary }}>로드</Text>
            </Text>
          </View>
        }
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}
        >
          <Text style={{ fontSize: 12, fontWeight: "600", color: t.fgMuted }}>
            김투자 님,
          </Text>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "800",
              color: t.fgStrong,
              letterSpacing: -0.3,
              marginTop: 2,
            }}
          >
            {greeting()}
          </Text>
        </View>

        <IndexStrip indices={indices} />

        {/*<View style={{ paddingHorizontal: 16, paddingTop: 16 }}>*/}
        {/*  <AiBriefCard*/}
        {/*    body="관심 종목 6건 중 4건이 긍정 이벤트. 두산에너빌리티 체코 원전 본계약과 SK하이닉스 HBM4 양산 일정 단축이 오늘의 핵심."*/}
        {/*    time="오전 7:30"*/}
        {/*  />*/}
        {/*</View>*/}

        <SectionHead
          more="전체보기 →"
          onMore={() => nav.goTab("signals")}
          title="오늘의 시그널"
        />
        {topSignals.map((sig) => (
          <SignalCard
            expanded={openSigId === sig.id}
            key={sig.id}
            onToggle={() => setOpenSigId(openSigId === sig.id ? null : sig.id)}
            signal={sig}
          />
        ))}

        <SectionHead
          more="전체보기 →"
          onMore={() => nav.goTab("news")}
          title="주요 뉴스"
        />
        {topNews.map((n) => (
          <NewsCard key={n.id} news={n} />
        ))}

        <SectionHead
          more={`전체보기 (${watched.length}) →`}
          onMore={nav.openWatchlist}
          title="내 관심 종목"
        />
        <View style={{ paddingBottom: 8 }}>
          {watchedPreview.map((s) => (
            <StockRow
              key={s.code}
              onPress={() => nav.openStock(s.code)}
              stock={s}
            />
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </MrScreen>
  );
}
