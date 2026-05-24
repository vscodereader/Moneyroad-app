import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// How notifications behave when received while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

let cachedToken: string | null = null;

/** The last Expo push token obtained this session (for logout cleanup). */
export function getRegisteredPushToken(): string | null {
  return cachedToken;
}

/**
 * Requests notification permission and returns the device's Expo push token.
 * Returns null on simulators/emulators, when permission is denied, or when no
 * EAS projectId is configured. Remote push requires a development build.
 */
export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (!Device.isDevice) {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "기본",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.status === "granted";
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.status === "granted";
  }
  if (!granted) {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as
    | string
    | undefined;
  if (!projectId) {
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    cachedToken = data;
    return data;
  } catch {
    return null;
  }
}
