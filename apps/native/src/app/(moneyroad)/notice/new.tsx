import { Redirect } from "expo-router";

import { authClient } from "@/lib/auth-client";
import CreateNoticeScreen from "@/screens/notice-new";

export default function CreateNoticeRoute() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <Redirect href="/(moneyroad)/login" />;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/mypage" />;
  }
  return <CreateNoticeScreen />;
}
