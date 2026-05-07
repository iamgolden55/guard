// AppLayout — sticky Sidebar + Topbar + scrollable Outlet. Renders the
// sidebar inline on >= lg, as a fixed drawer below.
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Sidebar } from "../components/navigation/Sidebar";
import { Topbar } from "../components/navigation/Topbar";
import { tokens } from "../design-system/tokens";

function useIsLarge(): boolean {
  const [isLarge, setIsLarge] = useState<boolean>(() =>
    typeof window === "undefined"
      ? true
      : window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);
  return isLarge;
}

export default function AppLayout() {
  const isLarge = useIsLarge();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();

  // Auto-close drawer when window grows past lg.
  useEffect(() => {
    if (isLarge && drawerOpen) setDrawerOpen(false);
  }, [isLarge, drawerOpen]);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: tokens.color.ink50,
      }}
    >
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
        }}
      >
        <Topbar
          onMenuClick={!isLarge ? () => setDrawerOpen(true) : undefined}
          onPrimaryAction={() => navigate("/scheduling")}
        />
        <main
          style={{
            flex: 1,
            padding: "24px 28px",
            background: tokens.color.ink50,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
