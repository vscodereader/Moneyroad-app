import { Fragment, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconProps } from "@/components/icons";
import { BackButton, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { type Notification, notifications } from "@/utils/data";
import { nav } from "@/utils/nav";
import type { MrTokens } from "@/utils/theme";

interface TypeMeta {
  bg: string;
  color: string;
  icon: (p: IconProps) => React.JSX.Element;
}

function typeMetaFor(type: Notification["type"], t: MrTokens): TypeMeta {
  switch (type) {
    case "news":
      return { color: t.primary, bg: t.primarySubtle, icon: Icon.navNews };
    case "tech":
      return { color: t.sigTech, bg: t.downBg, icon: Icon.trending };
    case "price":
      return { color: t.upStrong, bg: t.upBg, icon: Icon.navWatch };
    case "community":
      return { color: t.sigCommunity, bg: t.successBg, icon: Icon.sigComm };
    default:
      return { color: t.sigEvent, bg: t.warningBg, icon: Icon.alert };
  }
}

function groupBySection(
  items: Notification[]
): { title: string; items: Notification[] }[] {
  const sections: { title: string; items: Notification[] }[] = [];
  for (const n of items) {
    const last = sections.at(-1);
    if (!last || last.title !== n.section) {
      sections.push({ title: n.section, items: [n] });
    } else {
      last.items.push(n);
    }
  }
  return sections;
}

export default function AlertsScreen() {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const sections = groupBySection(notifications);

  return (
    <MrScreen>
      <MrHeader
        left={<BackButton onPress={nav.back} />}
        right={
          <Pressable
            hitSlop={6}
            onPress={() => setReadIds(new Set(notifications.map((n) => n.id)))}
            style={{ paddingHorizontal: 8, justifyContent: "center" }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.primary }}>
              모두 읽음
            </Text>
          </Pressable>
        }
        title="알림함"
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        {sections.map((sec) => (
          <Fragment key={sec.title}>
            <Text
              style={{
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 4,
                fontSize: 12,
                fontWeight: "700",
                color: t.fgMuted,
                backgroundColor: t.bgSubtle,
              }}
            >
              {sec.title}
            </Text>
            {sec.items.map((n) => {
              const m = typeMetaFor(n.type, t);
              const NotifIcon = m.icon;
              const isUnread = n.unread && !readIds.has(n.id);
              return (
                <View
                  key={n.id}
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    backgroundColor: t.bg,
                    borderTopWidth: 1,
                    borderTopColor: t.border,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: m.bg,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <NotifIcon color={m.color} size={18} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: t.fgStrong,
                      }}
                    >
                      {n.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: t.fgMuted,
                        marginTop: 2,
                        lineHeight: 19,
                      }}
                    >
                      {n.body}
                    </Text>
                    <Text
                      style={{ fontSize: 11, color: t.fgSubtle, marginTop: 6 }}
                    >
                      {n.time}
                    </Text>
                  </View>
                  {isUnread ? (
                    <View
                      style={{
                        position: "absolute",
                        top: 20,
                        right: 16,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        backgroundColor: t.primary,
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </Fragment>
        ))}
        <View style={{ height: 16 + insets.bottom }} />
      </ScrollView>
    </MrScreen>
  );
}
