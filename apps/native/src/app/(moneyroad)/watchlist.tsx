import { AuthGate } from "@/components/auth-gate";
import WatchlistScreen from "@/screens/watchlist";

export default function WatchlistRoute() {
  return (
    <AuthGate>
      <WatchlistScreen />
    </AuthGate>
  );
}
