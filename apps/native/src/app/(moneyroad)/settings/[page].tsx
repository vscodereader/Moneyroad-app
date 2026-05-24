import { AuthGate } from "@/components/auth-gate";
import SettingsPageScreen from "@/screens/settings";

export default function SettingsPageRoute() {
  return (
    <AuthGate>
      <SettingsPageScreen />
    </AuthGate>
  );
}
