import { useAppTheme } from "@/contexts/app-theme-context";
import { darkTokens, lightTokens, type MrTokens } from "@/utils/theme";

export function useMrTheme(): { t: MrTokens; isDark: boolean } {
  const { isDark } = useAppTheme();
  return { t: isDark ? darkTokens : lightTokens, isDark };
}
