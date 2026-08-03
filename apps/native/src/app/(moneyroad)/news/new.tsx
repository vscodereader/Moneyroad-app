import { Redirect, useLocalSearchParams } from "expo-router";

import { authClient } from "@/lib/auth-client";
import NewsFormScreen from "@/screens/news-new";

export default function NewsFormRoute() {
  const { data: session, isPending } = authClient.useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <Redirect href="/(moneyroad)/login" />;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/news" />;
  }
  return <NewsFormScreen newsId={id || undefined} />;
}
