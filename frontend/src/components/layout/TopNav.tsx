import { useMemo } from "react";

import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";

export function TopNav() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const nextTheme = useMemo(() => (theme === "light" ? "dark" : "light"), [theme]);

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

        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1 text-sm hover:bg-muted">
            {user?.name ?? "访客"}
          </summary>
          <div className="absolute right-0 mt-2 w-36 rounded-md border border-border bg-background p-1 shadow-md">
            <a href="#" className="block rounded px-2 py-1 text-sm hover:bg-muted">
              个人中心
            </a>
            <button
              type="button"
              onClick={logout}
              className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
            >
              退出
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
