import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        "surface-elevated": "hsl(var(--surface-elevated))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        destructive: "hsl(var(--destructive))",
        "destructive-surface": "hsl(var(--destructive-surface))",
        success: "hsl(var(--success))",
        "success-surface": "hsl(var(--success-surface))",
        warning: "hsl(var(--warning))",
        "warning-surface": "hsl(var(--warning-surface))",
        info: "hsl(var(--info))",
        "info-surface": "hsl(var(--info-surface))",
      },
    },
  },
};

export default config;
