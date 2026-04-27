// FullScreenAppLayout — Sidebar + flush <Outlet/>. Used by routes that
// bring their own page-level header (Attendance, Scheduling) so the
// AppLayout Topbar wouldn't be redundant alongside the prototype's
// custom header strip.
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/navigation/Sidebar";
import { Icon } from "../design-system/Icon";
import { tokens } from "../design-system/tokens";

function useIsLarge(): boolean {
  const [isLarge, setIsLarge] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);
  return isLarge;
}

export default function FullScreenAppLayout() {
  const isLarge = useIsLarge();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (isLarge && drawerOpen) setDrawerOpen(false);
  }, [isLarge, drawerOpen]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: tokens.color.ink50 }}>
      {isLarge && <Sidebar />}

      {!isLarge && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(32,31,30,0.45)",
              backdropFilter: "blur(2px)",
              zIndex: tokens.z.modal - 1,
            }}
          />
          <Sidebar drawer onNavigate={() => setDrawerOpen(false)} />
        </>
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {!isLarge && (
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              width: 40,
              height: 40,
              borderRadius: 8,
              background: "white",
              border: `1px solid ${tokens.color.ink200}`,
              color: tokens.color.ink800,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: tokens.shadow.sm,
              zIndex: tokens.z.sticky,
            }}
          >
            <Icon name="menu" size={20} />
          </button>
        )}
        <Outlet />
      </div>
    </div>
  );
}
