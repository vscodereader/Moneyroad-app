import { AuthGate } from "@/components/auth-gate";
import MyPageScreen from "@/screens/mypage";

export default function MyPageRoute() {
  return (
    <AuthGate>
      <MyPageScreen />
    </AuthGate>
  );
}
