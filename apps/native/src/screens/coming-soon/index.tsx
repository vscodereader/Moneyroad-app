import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/icons";
import { nav } from "@/utils/nav";

const SPIN_DURATION_MS = 3600;

// Full-screen, semi-transparent "coming soon" overlay. Rendered over the
// previous screen via a transparentModal route; tapping anywhere goes back.
// The gear slowly rotates to convey "work in progress".
export default function ComingSoonScreen() {
  const spin = useSharedValue(0);

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(1, { duration: SPIN_DURATION_MS, easing: Easing.linear }),
      -1,
      false
    );
  }, [spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

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
        <Animated.View style={spinStyle}>
          <Icon.gear color="#fff" size={28} />
        </Animated.View>
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
