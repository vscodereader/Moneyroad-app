import { AuthGate } from "@/components/auth-gate";
import WatchlistScreen from "@/screens/watchlist";

export default function WatchlistRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/watchlist">
      <WatchlistScreen />
    </AuthGate>
  );
}
