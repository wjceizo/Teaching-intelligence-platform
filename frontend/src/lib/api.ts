import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    throw new ApiError("用户信息已经过期，请重新登录。", 401);
  }

  if (!response.ok) {
    let errorMessage = "请求失败";

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

  if (response.status === 204) {
    return undefined as T;
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

export interface TeacherSummary {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface ChapterSummary {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface ChapterDetail extends ChapterSummary {
  content: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  teacher_id: string;
  cover_image: string | null;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
  teacher: TeacherSummary;
  chapters_count: number;
  chapters: ChapterSummary[];
  is_enrolled: boolean;
  progress_percent: number;
  completed_chapter_ids: string[];
}

export interface PaginatedCourses {
  data: Course[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface CourseInput {
  title: string;
  description?: string;
  cover_image?: string;
}

export interface CourseUpdateInput extends Partial<CourseInput> {
  status?: "draft" | "published";
}

export interface ChapterCreateInput {
  title: string;
  content: string;
  order_index: number;
}

export interface ChapterUpdateInput {
  title?: string;
  content?: string;
  order_index?: number;
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

      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new ApiError("密码错误或者该用户不存在", 401);
        }

        let errorMessage = "登录失败，请稍后再试。";
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

      const tokens = (await response.json()) as AuthTokens;
      useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);

      const me = await apiFetch<AuthUser>("/v1/auth/me");
      useAuthStore.getState().setUser({ id: me.id, name: me.username, role: me.role });

      return { tokens, me };
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (input: RegisterInput) =>
      apiFetch<AuthUser>("/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiFetch<AuthUser>("/v1/auth/me"),
    enabled,
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

export function useCourses(page: number, pageSize: number, status?: "draft" | "published") {
  return useQuery({
    queryKey: ["courses", page, pageSize, status],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (status) {
        params.set("status", status);
      }
      return apiFetch<PaginatedCourses>(`/v1/courses?${params.toString()}`);
    },
  });
}

export function useCourse(id?: string) {
  return useQuery({
    queryKey: ["course", id],
    queryFn: () => apiFetch<Course>(`/v1/courses/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CourseInput) =>
      apiFetch<Course>("/v1/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CourseUpdateInput }) =>
      apiFetch<Course>(`/v1/courses/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: (course) => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
      void queryClient.invalidateQueries({ queryKey: ["course", course.id] });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/v1/courses/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
    },
  });
}

export function useCreateChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, input }: { courseId: string; input: ChapterCreateInput }) =>
      apiFetch<ChapterSummary>(`/v1/courses/${courseId}/chapters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["course", variables.courseId] });
    },
  });
}

export function useUpdateChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, input }: { chapterId: string; input: ChapterUpdateInput }) =>
      apiFetch<ChapterDetail>(`/v1/courses/chapters/${chapterId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: (chapter) => {
      void queryClient.invalidateQueries({ queryKey: ["chapter-content", chapter.id] });
      void queryClient.invalidateQueries({ queryKey: ["course", chapter.course_id] });
    },
  });
}

export function useDeleteChapter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId }: { chapterId: string }) =>
      apiFetch<void>(`/v1/courses/chapters/${chapterId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}

export function useReorderChapters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      chapters,
    }: {
      courseId: string;
      chapters: Array<{ id: string; order_index: number }>;
    }) =>
      apiFetch<void>(`/v1/courses/${courseId}/chapters/reorder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chapters }),
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["course", variables.courseId] });
    },
  });
}

export function useChapterContent(chapterId?: string) {
  return useQuery({
    queryKey: ["chapter-content", chapterId],
    queryFn: () => apiFetch<ChapterDetail>(`/v1/courses/chapters/${chapterId}/content`),
    enabled: Boolean(chapterId),
  });
}

export function useEnroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      apiFetch<{ detail: string }>(`/v1/courses/${courseId}/enroll`, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
      void queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, completed }: { chapterId: string; completed: boolean }) =>
      apiFetch<void>(`/v1/courses/chapters/${chapterId}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
      void queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}
