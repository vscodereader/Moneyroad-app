import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { ThreadRow } from "@/features/moneyroad/cards";
import {
  Chip,
  IconButton,
  MrHeader,
  MrScreen,
} from "@/features/moneyroad/components";
import { stocks, threads } from "@/features/moneyroad/data";
import { Icon } from "@/features/moneyroad/icons";
import { nav } from "@/features/moneyroad/nav";
import { useMrTheme } from "@/features/moneyroad/theme";

type DiscussTab = "hot" | "watch" | "recent";

const TABS: { k: DiscussTab; l: string }[] = [
  { k: "hot", l: "인기" },
  { k: "watch", l: "관심 종목" },
  { k: "recent", l: "최신" },
];

export default function DiscussScreen() {
  const { t } = useMrTheme();
  const [tab, setTab] = useState<DiscussTab>("hot");
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const watchedCodes = new Set(
    stocks.filter((s) => s.watched).map((s) => s.code)
  );
  let list = threads;
  if (tab === "watch") {
    list = threads.filter((th) => watchedCodes.has(th.code));
  } else if (tab === "hot") {
    list = [...threads].sort((a, b) => b.likes - a.likes);
  }

  const toggleLike = (id: string) => {
    const next = new Set(liked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setLiked(next);
  };

  return (
    <MrScreen>
      <MrHeader
        right={
          <IconButton>
            <Icon.search color={t.fgStrong} size={22} />
          </IconButton>
        }
        title="토론"
      />
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

        {list.map((th) => (
          <ThreadRow
            key={th.id}
            liked={liked.has(th.id)}
            onPress={() => nav.openThread(th.id)}
            onToggleLike={() => toggleLike(th.id)}
            thread={th}
          />
        ))}
        <View style={{ height: 16 }} />
      </ScrollView>

      <Pressable
        style={{
          position: "absolute",
          right: 16,
          bottom: 24,
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
    </MrScreen>
  );
}
