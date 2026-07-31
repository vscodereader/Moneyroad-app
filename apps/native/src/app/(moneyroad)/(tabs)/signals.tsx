import { AuthGate } from "@/components/auth-gate";
import SignalsScreen from "@/screens/signals";

export default function SignalsRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/(tabs)/signals">
      <SignalsScreen />
    </AuthGate>
  );
}
