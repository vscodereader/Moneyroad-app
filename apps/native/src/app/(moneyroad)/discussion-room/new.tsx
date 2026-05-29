import { Redirect } from "expo-router";

import { authClient } from "@/lib/auth-client";
import CreateDiscussionRoomScreen from "@/screens/discussion-room-new";

export default function CreateDiscussionRoomRoute() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <Redirect href="/(moneyroad)/login" />;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/discuss" />;
  }
  return <CreateDiscussionRoomScreen />;
}
