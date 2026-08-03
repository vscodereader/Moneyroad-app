import { Redirect, useLocalSearchParams } from "expo-router";

import { AuthGate } from "@/components/auth-gate";
import { authClient } from "@/lib/auth-client";
import NewsFormScreen from "@/screens/news-new";
import type { MoneyRoadReturnTo } from "@/utils/auth-navigation";

function AdminNewsForm({ newsId }: { newsId?: string }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return null;
  }
  if (session.user.role !== "admin") {
    return <Redirect href="/(moneyroad)/(tabs)/news" />;
  }
  return <NewsFormScreen newsId={newsId} />;
}

export default function NewsFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const returnTo = (
    id
      ? `/(moneyroad)/news/new?id=${encodeURIComponent(id)}`
      : "/(moneyroad)/news/new"
  ) as MoneyRoadReturnTo;
  return (
    <AuthGate returnTo={returnTo}>
      <AdminNewsForm newsId={id || undefined} />
    </AuthGate>
  );
}
