import { useLocalSearchParams } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import ComingSoonScreen from "@/screens/coming-soon";
import SettingsPageScreen from "@/screens/settings";
import type { MoneyRoadReturnTo } from "@/utils/auth-navigation";

// Post-MVP pages show a transparent "coming soon" overlay over the previous
// screen (see the transparentModal presentation in (moneyroad)/_layout.tsx).
// Every other settings page renders its real screen.
const COMING_SOON_PAGES = new Set(["ai", "display", "invite"]);

export default function SettingsPageRoute() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const returnTo =
    `/(moneyroad)/settings/${encodeURIComponent(page)}` as MoneyRoadReturnTo;

  return (
    <AuthGate returnTo={returnTo}>
      {COMING_SOON_PAGES.has(page) ? (
        <ComingSoonScreen />
      ) : (
        <SettingsPageScreen />
      )}
    </AuthGate>
  );
}
