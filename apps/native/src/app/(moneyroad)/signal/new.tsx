import { Redirect } from "expo-router";

import { authClient } from "@/lib/auth-client";
import CreateSignalScreen from "@/screens/signal-new";

export default function CreateSignalRoute() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <Redirect href="/(moneyroad)/login" />;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/signals" />;
  }
  return <CreateSignalScreen />;
}
