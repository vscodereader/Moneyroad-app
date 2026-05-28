import { Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icons";
import { nav } from "@/utils/nav";

// Full-screen, semi-transparent "coming soon" overlay. Rendered over the
// previous screen via a transparentModal route; tapping anywhere goes back.
export default function ComingSoonScreen() {
  return (
    <Pressable
      onPress={nav.back}
      style={{
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          backgroundColor: "rgba(255, 255, 255, 0.12)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon.sparkles color="#fff" size={28} />
      </View>
      <Text
        style={{
          color: "#fff",
          fontSize: 18,
          fontWeight: "800",
          marginTop: 18,
        }}
      >
        준비 중이에요
      </Text>
      <Text
        style={{
          color: "rgba(255, 255, 255, 0.72)",
          fontSize: 13,
          lineHeight: 20,
          marginTop: 8,
          textAlign: "center",
        }}
      >
        이 기능은 곧 제공될 예정이에요.{"\n"}화면을 터치하면 돌아갑니다.
      </Text>
    </Pressable>
  );
}
