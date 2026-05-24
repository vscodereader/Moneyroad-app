import { Text, View } from "react-native";

import { BackButton, MrHeader, MrScreen } from "@/components/ui";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { nav } from "@/utils/nav";

// Placeholder: gate target for screens that require auth (e.g. mypage).
// Real sign-in (email/social) is a follow-up step.
export default function LoginScreen() {
  const { t } = useMrTheme();
  return (
    <MrScreen>
      <MrHeader left={<BackButton onPress={nav.back} />} title="로그인" />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "800", color: t.fgStrong }}>
          로그인이 필요해요
        </Text>
        <Text
          style={{
            fontSize: 13,
            lineHeight: 20,
            color: t.fgSubtle,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          마이 페이지는 로그인 후 이용할 수 있어요. 로그인 기능은 곧 추가됩니다.
        </Text>
      </View>
    </MrScreen>
  );
}
