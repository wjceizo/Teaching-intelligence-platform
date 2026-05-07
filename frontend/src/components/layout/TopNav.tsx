import { useMemo, useRef, useState } from "react";

import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";

export function TopNav() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const [menuOpen, setMenuOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const nextTheme = useMemo(() => (theme === "light" ? "dark" : "light"), [theme]);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openMenu = () => {
    clearCloseTimer();
    setMenuOpen(true);
  };

  const closeMenuLater = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false);
    }, 320);
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
        >
          菜单
        </button>
        <div className="font-semibold text-primary">MathEdu AI</div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTheme(nextTheme)}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          {theme === "light" ? "暗色" : "亮色"}
        </button>

        <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenuLater}>
          <button type="button" className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted">
            {user?.name ?? "访客"}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-36 rounded-md border border-border bg-white p-1 shadow-lg">
              <button
                type="button"
                className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
              >
                个人中心
              </button>
              <button
                type="button"
                onClick={logout}
                className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
              >
                退出
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
