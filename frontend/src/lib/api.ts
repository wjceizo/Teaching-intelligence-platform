import { useMutation, useQuery } from "@tanstack/react-query";

import { useAuthStore } from "../stores/authStore";

const API_BASE_URL = "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function buildHeaders(headers?: HeadersInit): Headers {
  const mergedHeaders = new Headers(headers);

  const token = useAuthStore.getState().token;
  if (token) {
    mergedHeaders.set("Authorization", `Bearer ${token}`);
  }

  return mergedHeaders;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError("Authentication expired", 401);
  }

  if (!response.ok) {
    let errorMessage = "Request failed";

    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "detail" in body) {
        const detail = (body as { detail: unknown }).detail;
        if (typeof detail === "string") {
          errorMessage = detail;
        }
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new ApiError(errorMessage, response.status);
  }

  return (await response.json()) as T;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: "student" | "teacher" | "admin";
  avatar_url: string | null;
  created_at: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  username?: string;
  avatar_url?: string;
}

export interface HealthResponse {
  data: {
    status: string;
    version: string;
  };
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<HealthResponse>("/health"),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const formData = new URLSearchParams();
      formData.set("username", input.email);
      formData.set("password", input.password);

      const tokens = await apiFetch<AuthTokens>("/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

      const me = await apiFetch<AuthUser>("/v1/auth/me");
      useAuthStore.getState().setUser({ id: me.id, name: me.username, role: me.role });

      return { tokens, me };
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      return apiFetch<AuthUser>("/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<AuthUser>("/v1/auth/me"),
  });
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<AuthUser>("/v1/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
  });
}
