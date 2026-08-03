import { Redirect, useLocalSearchParams } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import { authClient } from "@/lib/auth-client";
import DiscussionRoomFormScreen from "@/screens/discussion-room-new";
import type { MoneyRoadReturnTo } from "@/utils/auth-navigation";

function AdminEditDiscussionRoom({ roomId }: { roomId: number }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return null;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/discuss" />;
  }
  if (!(Number.isFinite(roomId) && roomId > 0)) {
    return <Redirect href="/(moneyroad)/(tabs)/discuss" />;
  }
  return <DiscussionRoomFormScreen roomId={roomId} />;
}

export default function EditDiscussionRoomRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = Number(id);
  const returnTo =
    `/(moneyroad)/discussion-room/edit/${id}` as MoneyRoadReturnTo;
  return (
    <AuthGate returnTo={returnTo}>
      <AdminEditDiscussionRoom roomId={roomId} />
    </AuthGate>
  );
}
