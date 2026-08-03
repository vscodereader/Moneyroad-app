import { Redirect } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import { authClient } from "@/lib/auth-client";
import CreateDiscussionRoomScreen from "@/screens/discussion-room-new";

function AdminCreateDiscussionRoom() {
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
  return <CreateDiscussionRoomScreen />;
}

export default function CreateDiscussionRoomRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/discussion-room/new">
      <AdminCreateDiscussionRoom />
    </AuthGate>
  );
}
