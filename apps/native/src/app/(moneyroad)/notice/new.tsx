import { Redirect } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import { authClient } from "@/lib/auth-client";
import CreateNoticeScreen from "@/screens/notice-new";

function AdminCreateNotice() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return null;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/mypage" />;
  }
  return <CreateNoticeScreen />;
}

export default function CreateNoticeRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/notice/new">
      <AdminCreateNotice />
    </AuthGate>
  );
}
