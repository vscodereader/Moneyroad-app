import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { DiscussionRoomRow } from "@/components/cards";
import { Icon } from "@/components/icons";
import { Chip, IconButton, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { discussionRooms, stocks } from "@/utils/data";
import { nav } from "@/utils/nav";

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
  let list = discussionRooms;
  if (tab === "watch") {
    list = discussionRooms.filter((r) => watchedCodes.has(r.code));
  } else if (tab === "hot") {
    list = [...discussionRooms].sort((a, b) => b.likes - a.likes);
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

        {list.map((r) => (
          <DiscussionRoomRow
            key={r.id}
            liked={liked.has(r.id)}
            onPress={() => nav.openDiscussionRoom(r.id)}
            onToggleLike={() => toggleLike(r.id)}
            room={r}
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
