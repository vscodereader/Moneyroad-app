import { useLocalSearchParams } from "expo-router";

import { SETTINGS_PAGES } from "@/features/moneyroad/settings-screens";

export default function SettingsPageScreen() {
  const { page } = useLocalSearchParams<{ page: string }>();
  const Screen = SETTINGS_PAGES[page] ?? SETTINGS_PAGES["signal-alert"];
  return <Screen />;
}
