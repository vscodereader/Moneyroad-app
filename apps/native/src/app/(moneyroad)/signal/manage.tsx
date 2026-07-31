import { Redirect } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import { authClient } from "@/lib/auth-client";
import ManageSignalsScreen from "@/screens/signal-manage";

function AdminManageSignals() {
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
  return <ManageSignalsScreen />;
}

export default function ManageSignalsRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/signal/manage">
      <AdminManageSignals />
    </AuthGate>
  );
}
