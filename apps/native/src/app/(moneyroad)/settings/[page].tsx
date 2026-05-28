import ComingSoonScreen from "@/screens/coming-soon";

// Settings pages are post-MVP. Until then this route shows a transparent
// "coming soon" overlay over the previous screen (see the transparentModal
// presentation in (moneyroad)/_layout.tsx). The real pages live in
// @/screens/settings and can be restored here later.
export default function SettingsPageRoute() {
  return <ComingSoonScreen />;
}
