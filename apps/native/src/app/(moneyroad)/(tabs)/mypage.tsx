import { type Href, Redirect } from "expo-router";
import { View } from "react-native";

import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";
import MyPageScreen from "@/screens/mypage";

export default function MyPageRoute() {
  const { t } = useMrTheme();
  const { data: session, isPending } = authClient.useSession();

  // Hold a blank themed screen until the session is hydrated so a logged-in
  // user never flashes the login redirect.
  if (isPending) {
    return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  }
  if (!session?.user) {
    return <Redirect href={"/(moneyroad)/login" as Href} />;
  }
  return <MyPageScreen />;
}
