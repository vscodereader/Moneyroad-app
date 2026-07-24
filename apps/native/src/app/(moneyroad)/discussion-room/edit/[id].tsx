import { Redirect, useLocalSearchParams } from "expo-router";

import { authClient } from "@/lib/auth-client";
import DiscussionRoomFormScreen from "@/screens/discussion-room-new";

export default function EditDiscussionRoomRoute() {
  const { data: session, isPending } = authClient.useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = Number(id);
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <Redirect href="/(moneyroad)/login" />;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/discuss" />;
  }
  if (!(Number.isFinite(roomId) && roomId > 0)) {
    return <Redirect href="/(moneyroad)/(tabs)/discuss" />;
  }
  return <DiscussionRoomFormScreen roomId={roomId} />;
}
