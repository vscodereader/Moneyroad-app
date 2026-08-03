import { useLocalSearchParams } from "expo-router";

import type { NewsTab } from "@/hooks/use-news-stream";
import NewsScreen from "@/screens/news";

export default function NewsRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const initialTab: NewsTab | undefined =
    tab === "watch" ||
    tab === "all" ||
    tab === "market" ||
    tab === "industry" ||
    tab === "company" ||
    tab === "global" ||
    tab === "policy"
      ? tab
      : undefined;
  return <NewsScreen initialTab={initialTab} />;
}
