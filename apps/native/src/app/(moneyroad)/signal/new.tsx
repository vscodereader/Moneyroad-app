import { Redirect } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import { authClient } from "@/lib/auth-client";
import CreateSignalScreen from "@/screens/signal-new";

function AdminCreateSignal() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return null;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/signals" />;
  }
  return <CreateSignalScreen />;
}

export default function CreateSignalRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/signal/new">
      <AdminCreateSignal />
    </AuthGate>
  );
}
