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
    }, 220);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-3 backdrop-blur md:px-4">
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="切换导航菜单"
          className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-sm hover:bg-muted"
        >
          菜单
        </button>
        <div className="truncate font-semibold text-primary">MathEdu AI</div>
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={() => setTheme(nextTheme)}
          aria-label="切换深浅色主题"
          className="inline-flex min-h-10 items-center rounded-md border border-border bg-surface px-3 text-sm hover:bg-muted"
        >
          {theme === "light" ? "夜间" : "日间"}
        </button>

        <div className="relative" onMouseEnter={openMenu} onMouseLeave={closeMenuLater}>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex min-h-10 max-w-[9rem] items-center rounded-md border border-border bg-surface px-3 text-sm hover:bg-muted"
          >
            <span className="truncate">{user?.name ?? "访客"}</span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-40 mt-2 w-40 rounded-md border border-border bg-surface-elevated p-1 shadow-xl">
              <button
                type="button"
                className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
              >
                个人中心
              </button>
              <button
                type="button"
                onClick={logout}
                className="block w-full rounded px-3 py-2 text-left text-sm text-destructive hover:bg-destructive-surface"
              >
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
