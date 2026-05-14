import { NavLink } from "react-router-dom";

import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";

interface NavItem {
  label: string;
  shortLabel: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: "仪表盘", shortLabel: "仪", to: "/dashboard" },
  { label: "课程", shortLabel: "课", to: "/courses" },
  { label: "问答", shortLabel: "问", to: "/qa" },
  { label: "笔记", shortLabel: "记", to: "/notes" },
  { label: "实训", shortLabel: "训", to: "/codelab" },
  { label: "测验", shortLabel: "测", to: "/exam" },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const closeSidebar = useUIStore((state) => state.closeSidebar);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  return (
    <>
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="关闭导航遮罩"
          onClick={closeSidebar}
          className="fixed inset-0 z-30 bg-black/45 md:hidden"
        />
      ) : null}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-14 z-40 border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:bg-muted/40",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          sidebarOpen ? "w-64 md:w-60" : "w-64 md:w-16"
        )}
      >
        <nav className="flex flex-col gap-2 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              onClick={(event) => {
                if (!token) {
                  event.preventDefault();
                  window.alert("登录已过期，请重新登录。");
                  logout();
                  return;
                }
                const media = window.matchMedia("(max-width: 767px)");
                if (media.matches) {
                  closeSidebar();
                }
              }}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm font-medium",
                  "hover:bg-primary/10 hover:text-primary",
                  isActive ? "bg-primary/15 text-primary" : "text-foreground"
                )
              }
            >
              <span className="md:hidden">{item.label}</span>
              <span className="hidden md:inline">{sidebarOpen ? item.label : item.shortLabel}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
