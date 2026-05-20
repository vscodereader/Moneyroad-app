import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { IndexStrip, StockRow } from "@/features/moneyroad/cards";
import {
  BackButton,
  Chip,
  IconButton,
  MrHeader,
  MrScreen,
} from "@/features/moneyroad/components";
import { indices, stocks } from "@/features/moneyroad/data";
import { Icon } from "@/features/moneyroad/icons";
import { nav } from "@/features/moneyroad/nav";
import { useMrTheme } from "@/features/moneyroad/theme";

type SortKey = "signal" | "change" | "name" | "added";

const SORTS: { k: SortKey; l: string }[] = [
  { k: "signal", l: "시그널 강한순" },
  { k: "change", l: "등락률" },
  { k: "name", l: "이름" },
  { k: "added", l: "추가일" },
];

export default function WatchlistScreen() {
  const { t } = useMrTheme();
  const [sort, setSort] = useState<SortKey>("signal");
  const watched = stocks.filter((s) => s.watched);
  const sorted = [...watched].sort((a, b) => {
    if (sort === "signal") {
      return b.score - a.score;
    }
    if (sort === "change") {
      return b.changePct - a.changePct;
    }
    if (sort === "name") {
      return a.name.localeCompare(b.name, "ko");
    }
    return 0;
  });

  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
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
        title="관심 종목"
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <IndexStrip indices={indices} />

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 6,
            paddingVertical: 10,
          }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {SORTS.map((c) => (
            <Chip
              active={sort === c.k}
              key={c.k}
              label={c.l}
              onPress={() => setSort(c.k)}
            />
          ))}
        </ScrollView>

        <View>
          {sorted.map((s) => (
            <StockRow
              key={s.code}
              onPress={() => nav.openStock(s.code)}
              stock={s}
            />
          ))}
        </View>

        <View style={{ padding: 16 }}>
          <Pressable
            onPress={nav.openSearch}
            style={{
              height: 48,
              borderRadius: 12,
              backgroundColor: t.bgSubtle,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Icon.plus color={t.fgMuted} size={18} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: t.fgMuted }}>
              종목 추가하기
            </Text>
          </Pressable>
        </View>
        <View style={{ height: 16 }} />
      </ScrollView>
    </MrScreen>
  );
}
