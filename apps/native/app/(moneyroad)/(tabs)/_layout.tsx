import { Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconProps } from "@/features/moneyroad/icons";
import { useMrTheme } from "@/features/moneyroad/theme";

interface TabBarProps {
  navigation: {
    emit: (event: {
      type: "tabPress";
      target: string;
      canPreventDefault: true;
    }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
  state: { index: number; routes: { key: string; name: string }[] };
}

const TAB_META: Record<
  string,
  { label: string; icon: (p: IconProps) => React.JSX.Element }
> = {
  index: { label: "홈", icon: Icon.navHome },
  signals: { label: "시그널", icon: Icon.navSignal },
  news: { label: "뉴스", icon: Icon.navNews },
  discuss: { label: "토론", icon: Icon.navDiscuss },
  mypage: { label: "마이", icon: Icon.navUser },
};

function MrTabBar({ state, navigation }: TabBarProps) {
  const { t } = useMrTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.bg,
        borderTopWidth: 1,
        borderTopColor: t.border,
        paddingTop: 6,
        paddingBottom: insets.bottom + 4,
        paddingHorizontal: 4,
      }}
    >
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) {
          return null;
        }
        const focused = state.index === index;
        const color = focused ? t.primary : t.fgSubtle;
        const TabIcon = meta.icon;
        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!(focused || event.defaultPrevented)) {
            navigation.navigate(route.name);
          }
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 2,
              paddingVertical: 6,
            }}
          >
            <TabIcon color={color} size={22} />
            <Text style={{ fontSize: 11, fontWeight: "600", color }}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <MrTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="signals" />
      <Tabs.Screen name="news" />
      <Tabs.Screen name="discuss" />
      <Tabs.Screen name="mypage" />
    </Tabs>
  );
}
