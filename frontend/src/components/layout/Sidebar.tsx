import { NavLink } from "react-router-dom";

import { cn } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";

interface NavItem {
  label: string;
  to: string;
}

const navItems: NavItem[] = [
  { label: "仪表盘", to: "/dashboard" },
  { label: "课程", to: "/courses" },
  { label: "问答", to: "/qa" },
  { label: "笔记", to: "/notes" },
  { label: "实训", to: "/codelab" },
  { label: "测验", to: "/exam" },
];

export function Sidebar() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);

  return (
    <aside
      className={cn(
        "border-r border-border bg-muted/40 transition-all duration-200",
        sidebarOpen ? "w-60" : "w-16"
      )}
    >
      <nav className="flex flex-col gap-2 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={(event) => {
              if (!token) {
                event.preventDefault();
                window.alert("用户信息已经过期，请重新登录。");
                logout();
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
            {sidebarOpen ? item.label : item.label.slice(0, 1)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
