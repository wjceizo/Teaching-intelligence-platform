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
  login: (user: AuthUser, token: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, token) => {
        set({ user, token, refreshToken: null, isAuthenticated: true });
      },
      setTokens: (token, refreshToken) => {
        set({ token, refreshToken, isAuthenticated: true });
      },
      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
    }
  )
);
