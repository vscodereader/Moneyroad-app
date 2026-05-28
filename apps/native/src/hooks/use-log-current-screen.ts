import { usePathname, useSegments } from "expo-router";
import { useEffect } from "react";

// Dev-only: logs the active route whenever it changes so you can see which
// screen is mounted from the Metro console. No-op in production builds.
export function useLogCurrentScreen() {
  const pathname = usePathname();
  const segments = useSegments();
  const segmentLabel = segments.join("/");

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    console.log(`[screen] ${pathname || "/"}  (${segmentLabel || "root"})`);
  }, [pathname, segmentLabel]);
}
