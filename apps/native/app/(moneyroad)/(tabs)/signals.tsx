import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { SignalCard } from "@/features/moneyroad/cards";
import {
  Chip,
  IconButton,
  MrHeader,
  MrScreen,
} from "@/features/moneyroad/components";
import { signals } from "@/features/moneyroad/data";
import { Icon } from "@/features/moneyroad/icons";
import {
  SIGNAL_TYPE_KEYS,
  type SignalTypeKey,
  useMrTheme,
} from "@/features/moneyroad/theme";

type FilterKey = "all" | SignalTypeKey;

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "전체",
  tech: "기술적",
  ai: "AI 모델",
  event: "이벤트",
  community: "커뮤니티",
};

export default function SignalsScreen() {
  const { t } = useMrTheme();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const list =
    filter === "all" ? signals : signals.filter((s) => s.type === filter);
  const counts: Record<FilterKey, number> = {
    all: signals.length,
    tech: signals.filter((s) => s.type === "tech").length,
    ai: signals.filter((s) => s.type === "ai").length,
    event: signals.filter((s) => s.type === "event").length,
    community: signals.filter((s) => s.type === "community").length,
  };
  const filterKeys: FilterKey[] = ["all", ...SIGNAL_TYPE_KEYS];

  return (
    <MrScreen>
      <MrHeader
        right={
          <IconButton>
            <Icon.sliders color={t.fgStrong} size={22} />
          </IconButton>
        }
        title="시그널"
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: t.fgMuted,
              letterSpacing: 0.3,
            }}
          >
            최근 24시간
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Text
              style={{
                fontSize: 26,
                fontWeight: "800",
                color: t.fgStrong,
                letterSpacing: -0.5,
              }}
            >
              {signals.length}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.fgMuted }}>
              건의 시그널
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 6,
            paddingVertical: 10,
          }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {filterKeys.map((k) => (
            <Chip
              active={filter === k}
              count={counts[k]}
              key={k}
              label={FILTER_LABELS[k]}
              onPress={() => setFilter(k)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingBottom: 8 }}>
          {list.map((sig) => (
            <SignalCard
              expanded={openId === sig.id}
              key={sig.id}
              onToggle={() => setOpenId(openId === sig.id ? null : sig.id)}
              signal={sig}
            />
          ))}
        </View>
        <View style={{ height: 16 }} />
      </ScrollView>
    </MrScreen>
  );
}
