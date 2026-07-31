import { OnboardingGate } from "@/components/onboarding-gate";
import OnboardingScreen from "@/screens/onboarding";

export default function OnboardingRoute() {
  return (
    <OnboardingGate>
      <OnboardingScreen />
    </OnboardingGate>
  );
}
