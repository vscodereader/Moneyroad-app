import { Redirect } from "expo-router";

import { authClient } from "@/lib/auth-client";
import SignalsScreen from "@/screens/signals";

export default function SignalsRoute() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <Redirect href="/(moneyroad)/login" />;
  }
  return <SignalsScreen />;
}
