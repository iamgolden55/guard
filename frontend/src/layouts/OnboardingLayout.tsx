// OnboardingLayout — full-bleed wizard chrome. Phase 8 fills in step
// navigation. For now it just renders children on the soft background
// so the OnboardingWizard route can mount without errors.
import { Outlet } from "react-router-dom";
import { tokens } from "../design-system/tokens";

export default function OnboardingLayout() {
  return (
    <div style={{ minHeight: "100vh", background: tokens.color.ink50 }}>
      <Outlet />
    </div>
  );
}
