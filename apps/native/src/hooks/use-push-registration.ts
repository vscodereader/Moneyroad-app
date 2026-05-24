import { useEffect, useRef } from "react";

import { authClient } from "@/lib/auth-client";
import { registerForPushNotificationsAsync } from "@/lib/push";
import { client } from "@/utils/orpc";

/**
 * Registers this device's Expo push token to the server once the user is
 * signed in (once per user). No-op without a session, or where push isn't
 * available (simulator, denied permission, no dev build).
 */
export function usePushRegistration(): void {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || registeredFor.current === userId) {
      return;
    }
    registeredFor.current = userId;
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        client.notification.registerPushToken({ token }).catch(() => {
          // best-effort; will retry on next app launch
          registeredFor.current = null;
        });
      }
    });
  }, [userId]);
}
