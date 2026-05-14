import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useUIStore } from "../../stores/uiStore";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function AppLayout() {
  const closeSidebar = useUIStore((state) => state.closeSidebar);
  const location = useLocation();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    if (media.matches) {
      closeSidebar();
    }
  }, [closeSidebar, location.pathname]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <div className="flex min-h-0 md:h-[calc(100dvh-3.5rem)]">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto px-3 py-4 md:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
