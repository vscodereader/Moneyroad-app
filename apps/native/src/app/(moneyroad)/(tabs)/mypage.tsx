import { AuthGate } from "@/components/auth-gate";
import MyPageScreen from "@/screens/mypage";

export default function MyPageRoute() {
  return (
    <AuthGate returnTo="/(moneyroad)/(tabs)/mypage">
      <MyPageScreen />
    </AuthGate>
  );
}
