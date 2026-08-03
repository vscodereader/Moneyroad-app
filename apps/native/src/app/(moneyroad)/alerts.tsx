import { AuthGate } from "@/components/auth-gate";
import AlertsScreen from "@/screens/alerts";

export default function AlertsRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/alerts">
      <AlertsScreen />
    </AuthGate>
  );
}
