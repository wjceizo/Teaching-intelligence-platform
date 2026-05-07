import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  name: string;
  role: "student" | "teacher" | "admin";
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  login: (user: AuthUser, token: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (user, token) => {
        set({ user, token, refreshToken: null, isAuthenticated: true });
      },
      setTokens: (token, refreshToken) => {
        set({ token, refreshToken, isAuthenticated: true });
      },
      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },
      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },
      logout: () => {
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
