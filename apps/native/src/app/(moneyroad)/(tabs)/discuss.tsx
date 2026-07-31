import { useLocalSearchParams } from "expo-router";
import type { DiscussTab } from "@/screens/discuss";
import DiscussScreen from "@/screens/discuss";

export default function DiscussRoute() {
  const { search, tab } = useLocalSearchParams<{
    search?: string;
    tab?: string;
  }>();
  const initialTab: DiscussTab | undefined =
    tab === "hot" || tab === "watch" || tab === "recent" || tab === "favorite"
      ? tab
      : undefined;

  return (
    <DiscussScreen initialSearchOpen={search === "1"} initialTab={initialTab} />
  );
}
