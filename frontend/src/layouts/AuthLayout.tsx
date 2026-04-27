// AuthLayout — centred card on the soft ink background. No chrome.
// Used by login/register/reset-password pages.
import { Outlet } from "react-router-dom";
import { tokens } from "../design-system/tokens";

export default function AuthLayout() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: tokens.color.ink50,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <Outlet />
    </div>
  );
}
