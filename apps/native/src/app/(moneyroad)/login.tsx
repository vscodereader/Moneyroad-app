import { useLocalSearchParams } from "expo-router";

import LoginScreen from "@/screens/login";
import { sanitizeReturnTo } from "@/utils/auth-navigation";

export default function LoginRoute() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  return <LoginScreen returnTo={sanitizeReturnTo(returnTo)} />;
}
