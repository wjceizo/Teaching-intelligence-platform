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

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const tokens = (await response.json()) as AuthTokens;
      useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
      return tokens.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function readApiError(response: Response): Promise<ApiError> {
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

  return new ApiError(errorMessage, response.status);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init?.headers),
  });

  if (response.status === 401) {
    if (path !== "/v1/auth/refresh") {
      const refreshedAccessToken = await refreshAccessToken();
      if (refreshedAccessToken) {
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set("Authorization", `Bearer ${refreshedAccessToken}`);

        const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
          ...init,
          headers: retryHeaders,
        });

        if (retryResponse.ok) {
          if (retryResponse.status === 204) {
            return undefined as T;
          }
          return (await retryResponse.json()) as T;
        }

        if (retryResponse.status !== 401) {
          throw await readApiError(retryResponse);
        }
      }
    }

    useAuthStore.getState().logout();
    throw new ApiError("用户信息已经过期，请重新登录。", 401);
  }

  if (!response.ok) {
    throw await readApiError(response);
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
          throw new ApiError("密码错误或用户不存在。", 401);
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

export interface QuestionUserSummary {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface AnswerUserSummary extends QuestionUserSummary {
  role: "student" | "teacher" | "admin";
}

export interface Answer {
  id: string;
  question_id: string;
  content: string;
  is_teacher: boolean;
  is_ai: boolean;
  upvotes: number;
  downvotes: number;
  created_at: string;
  user: AnswerUserSummary | null;
  user_vote: -1 | 0 | 1;
}

export interface Question {
  id: string;
  user_id: string;
  course_id: string;
  chapter_id: string | null;
  title: string;
  content: string;
  type: "ai" | "teacher";
  status: "open" | "resolved";
  is_pinned: boolean;
  view_count: number;
  paragraph_ref: string | null;
  course_title: string | null;
  chapter_title: string | null;
  created_at: string;
  user: QuestionUserSummary;
  answers_count: number;
}

export interface QuestionDetail extends Question {
  answers: Answer[];
  paragraph_excerpt: string | null;
}

export interface QuestionFilters {
  course_id?: string;
  chapter_id?: string;
  type?: "ai" | "teacher";
  status?: "open" | "resolved";
  sort?: "latest" | "hot" | "unanswered";
}

export interface PaginatedQuestions {
  data: Question[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface QuestionCreateInput {
  title: string;
  content: string;
  course_id: string;
  chapter_id?: string;
  type: "ai" | "teacher";
  paragraph_ref?: string;
}

export interface QuestionUpdateInput {
  title?: string;
  content?: string;
  course_id?: string;
  chapter_id?: string;
  type?: "ai" | "teacher";
  paragraph_ref?: string;
}

export interface AnswerCreateInput {
  content: string;
}

export function useQuestions(filters: QuestionFilters, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["questions", filters, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });
      if (filters.course_id) {
        params.set("course_id", filters.course_id);
      }
      if (filters.chapter_id) {
        params.set("chapter_id", filters.chapter_id);
      }
      if (filters.type) {
        params.set("type", filters.type);
      }
      if (filters.status) {
        params.set("status", filters.status);
      }
      if (filters.sort) {
        params.set("sort", filters.sort);
      }
      return apiFetch<PaginatedQuestions>(`/v1/questions?${params.toString()}`);
    },
  });
}

export function useQuestion(id?: string) {
  return useQuery({
    queryKey: ["question", id],
    queryFn: () => apiFetch<QuestionDetail>(`/v1/questions/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuestionCreateInput) =>
      apiFetch<Question>("/v1/questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, input }: { questionId: string; input: QuestionUpdateInput }) =>
      apiFetch<Question>(`/v1/questions/${questionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: (question) => {
      void queryClient.invalidateQueries({ queryKey: ["question", question.id] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      apiFetch<void>(`/v1/questions/${questionId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
      void queryClient.invalidateQueries({ queryKey: ["question"] });
    },
  });
}

export function useCreateAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, input }: { questionId: string; input: AnswerCreateInput }) =>
      apiFetch<Answer>(`/v1/questions/${questionId}/answers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["question", variables.questionId] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useUpdateAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId, content }: { answerId: string; content: string }) =>
      apiFetch<Answer>(`/v1/questions/answers/${answerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["question"] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useDeleteAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answerId: string) =>
      apiFetch<void>(`/v1/questions/answers/${answerId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["question"] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useVoteAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId, vote }: { answerId: string; vote: -1 | 0 | 1 }) =>
      apiFetch<Answer>(`/v1/questions/answers/${answerId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ vote }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["question"] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useResolveQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      apiFetch<Question>(`/v1/questions/${questionId}/resolve`, {
        method: "POST",
      }),
    onSuccess: (question) => {
      void queryClient.invalidateQueries({ queryKey: ["question", question.id] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useTogglePinQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) =>
      apiFetch<Question>(`/v1/questions/${questionId}/pin`, {
        method: "POST",
      }),
    onSuccess: (question) => {
      void queryClient.invalidateQueries({ queryKey: ["question", question.id] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export interface NoteUserSummary {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface Note {
  id: string;
  user_id: string;
  course_id: string | null;
  chapter_id: string | null;
  title: string | null;
  content: string;
  tags: string[];
  is_public: boolean;
  source_paragraph_ref: string | null;
  created_at: string;
  updated_at: string;
  user: NoteUserSummary;
  course_title: string | null;
  chapter_title: string | null;
}

export interface NoteFilters {
  course_id?: string;
  chapter_id?: string;
  is_public?: boolean;
  tags?: string[];
  q?: string;
}

export interface PaginatedNotes {
  data: Note[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface NoteCreateInput {
  title?: string;
  content: string;
  course_id?: string;
  chapter_id?: string;
  tags?: string[];
  is_public?: boolean;
  source_paragraph_ref?: string;
}

export interface NoteUpdateInput {
  title?: string | null;
  content?: string;
  course_id?: string | null;
  chapter_id?: string | null;
  tags?: string[];
  is_public?: boolean;
  source_paragraph_ref?: string | null;
}

export interface NoteShareInput {
  expires_in_hours?: 1 | 24 | 168;
}

export interface NoteShareResponse {
  token: string;
  share_url: string;
  expires_at: string | null;
}

function buildNoteParams(filters: NoteFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.course_id) {
    params.set("course_id", filters.course_id);
  }
  if (filters.chapter_id) {
    params.set("chapter_id", filters.chapter_id);
  }
  if (typeof filters.is_public === "boolean") {
    params.set("is_public", String(filters.is_public));
  }
  if (filters.tags?.length) {
    params.set("tags", filters.tags.join(","));
  }
  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }
  return params.toString();
}

export function useNotes(filters: NoteFilters, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ["notes", filters, page, pageSize],
    queryFn: () => apiFetch<PaginatedNotes>(`/v1/notes?${buildNoteParams(filters, page, pageSize)}`),
  });
}

export function useNote(id?: string) {
  return useQuery({
    queryKey: ["notes", id],
    queryFn: () => apiFetch<Note>(`/v1/notes/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NoteCreateInput) =>
      apiFetch<Note>("/v1/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      if (note.chapter_id) {
        void queryClient.invalidateQueries({ queryKey: ["notes", "chapter", note.chapter_id, "public"] });
      }
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: NoteUpdateInput }) =>
      apiFetch<Note>(`/v1/notes/${noteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["notes", note.id] });
      if (note.chapter_id) {
        void queryClient.invalidateQueries({ queryKey: ["notes", "chapter", note.chapter_id, "public"] });
      }
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) =>
      apiFetch<void>(`/v1/notes/${noteId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useCreateNoteShare() {
  return useMutation({
    mutationFn: ({ noteId, input }: { noteId: string; input: NoteShareInput }) =>
      apiFetch<NoteShareResponse>(`/v1/notes/${noteId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
  });
}

export function useSharedNote(token?: string) {
  return useQuery({
    queryKey: ["notes", "shared", token],
    queryFn: () => apiFetch<Note>(`/v1/notes/shared/${token}`),
    enabled: Boolean(token),
  });
}

export function useChapterPublicNotes(chapterId?: string) {
  return useQuery({
    queryKey: ["notes", "chapter", chapterId, "public"],
    queryFn: () => apiFetch<Note[]>(`/v1/notes/chapter/${chapterId}/public`),
    enabled: Boolean(chapterId),
  });
}

export interface CodeLabTestCase {
  id?: string;
  name: string;
  input_data: string | null;
  expected_output: string | null;
  is_hidden: boolean;
  points: number;
  order_index: number;
}

export interface CodeLabSubmissionSummary {
  id: string;
  mode: "run" | "submit";
  status: "pending" | "running" | "success" | "failed" | "error" | "timeout";
  score: number;
  max_score: number;
  tests_passed: number;
  tests_total: number;
  execution_time_ms: number | null;
  submitted_at: string;
}

export interface CodeLabListItem {
  id: string;
  title: string;
  course_id: string;
  course_title: string | null;
  chapter_id: string | null;
  chapter_title: string | null;
  language: "python" | "javascript" | "cpp";
  difficulty: number;
  is_published: boolean;
  max_score: number;
  latest_submission: CodeLabSubmissionSummary | null;
  best_score: number | null;
  submissions_count: number;
  created_at: string;
  updated_at: string;
}

export interface CodeLab extends CodeLabListItem {
  description: string;
  teacher_id: string;
  teacher: TeacherSummary | null;
  starter_code: string;
  solution_code: string | null;
  time_limit_ms: number;
  memory_limit_mb: number;
  test_cases: CodeLabTestCase[];
}

export interface CodeLabRunResult {
  test_case_id: string;
  name: string;
  is_hidden: boolean;
  passed: boolean;
  points: number;
  actual_output: string | null;
  expected_output: string | null;
  input_data: string | null;
  error: string | null;
  execution_time_ms: number | null;
}

export interface CodeLabSubmission extends CodeLabSubmissionSummary {
  codelab_id: string;
  user_id: string;
  code: string;
  results: CodeLabRunResult[];
  logs: string | null;
}

export interface CodeLabFilters {
  course_id?: string;
  chapter_id?: string;
  language?: "python" | "javascript" | "cpp";
  difficulty?: number;
  is_published?: boolean;
  q?: string;
}

export interface PaginatedCodeLabs {
  data: CodeLabListItem[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface PaginatedCodeLabSubmissions {
  data: CodeLabSubmission[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}

export interface CodeLabTestCaseInput {
  name: string;
  input_data: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  order_index: number;
}

export interface CodeLabCreateInput {
  title: string;
  description: string;
  course_id: string;
  chapter_id?: string | null;
  language: "python" | "javascript" | "cpp";
  starter_code: string;
  solution_code?: string | null;
  difficulty: number;
  max_score: number;
  time_limit_ms: number;
  memory_limit_mb: number;
  is_published: boolean;
  test_cases: CodeLabTestCaseInput[];
}

export interface CodeLabUpdateInput extends Partial<CodeLabCreateInput> {}

export interface GenerateExpectedOutputsInput {
  language: "python" | "javascript" | "cpp";
  solution_code: string;
  test_cases: CodeLabTestCaseInput[];
  time_limit_ms: number;
  memory_limit_mb: number;
}

export interface GeneratedExpectedOutput {
  name: string;
  input_data: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  order_index: number;
  status: "pending" | "running" | "success" | "failed" | "error" | "timeout";
  error: string | null;
}

export interface GenerateExpectedOutputsResponse {
  test_cases: GeneratedExpectedOutput[];
  logs: string | null;
}

function buildCodeLabParams(filters: CodeLabFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters.course_id) {
    params.set("course_id", filters.course_id);
  }
  if (filters.chapter_id) {
    params.set("chapter_id", filters.chapter_id);
  }
  if (filters.language) {
    params.set("language", filters.language);
  }
  if (filters.difficulty) {
    params.set("difficulty", String(filters.difficulty));
  }
  if (typeof filters.is_published === "boolean") {
    params.set("is_published", String(filters.is_published));
  }
  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }
  return params.toString();
}

export function useCodeLabs(filters: CodeLabFilters, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ["codelabs", filters, page, pageSize],
    queryFn: () => apiFetch<PaginatedCodeLabs>(`/v1/codelabs?${buildCodeLabParams(filters, page, pageSize)}`),
  });
}

export function useCodeLab(id?: string) {
  return useQuery({
    queryKey: ["codelabs", id],
    queryFn: () => apiFetch<CodeLab>(`/v1/codelabs/${id}`),
    enabled: Boolean(id),
  });
}

export function useTeacherCodeLab(id?: string) {
  return useQuery({
    queryKey: ["teacher-codelabs", id],
    queryFn: () => apiFetch<CodeLab>(`/v1/codelabs/${id}/teacher`),
    enabled: Boolean(id),
  });
}

export function useCreateCodeLab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CodeLabCreateInput) =>
      apiFetch<CodeLab>("/v1/codelabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["codelabs"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-codelabs"] });
    },
  });
}

export function useUpdateCodeLab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CodeLabUpdateInput }) =>
      apiFetch<CodeLab>(`/v1/codelabs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: (codelab) => {
      void queryClient.invalidateQueries({ queryKey: ["codelabs"] });
      void queryClient.invalidateQueries({ queryKey: ["codelabs", codelab.id] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-codelabs"] });
    },
  });
}

export function useDeleteCodeLab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/codelabs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["codelabs"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-codelabs"] });
    },
  });
}

export function usePublishCodeLab() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      apiFetch<CodeLab>(`/v1/codelabs/${id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published }),
      }),
    onSuccess: (codelab) => {
      void queryClient.invalidateQueries({ queryKey: ["codelabs"] });
      void queryClient.invalidateQueries({ queryKey: ["codelabs", codelab.id] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-codelabs"] });
    },
  });
}

export function useGenerateExpectedOutputs() {
  return useMutation({
    mutationFn: (input: GenerateExpectedOutputsInput) =>
      apiFetch<GenerateExpectedOutputsResponse>("/v1/codelabs/generate-expected-outputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  });
}

export function useRunCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ codelabId, code }: { codelabId: string; code: string }) =>
      apiFetch<CodeLabSubmission>(`/v1/codelabs/${codelabId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["codelabs", variables.codelabId, "submissions"] });
    },
  });
}

export function useSubmitCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ codelabId, code }: { codelabId: string; code: string }) =>
      apiFetch<CodeLabSubmission>(`/v1/codelabs/${codelabId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["codelabs"] });
      void queryClient.invalidateQueries({ queryKey: ["codelabs", variables.codelabId] });
      void queryClient.invalidateQueries({ queryKey: ["codelabs", variables.codelabId, "submissions"] });
    },
  });
}

export function useMyCodeSubmissions(codelabId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["codelabs", codelabId, "submissions", page, pageSize],
    queryFn: () => apiFetch<PaginatedCodeLabSubmissions>(`/v1/codelabs/${codelabId}/submissions?page=${page}&page_size=${pageSize}`),
    enabled: Boolean(codelabId),
  });
}

export function useTeacherCodeSubmissions(codelabId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["teacher-codelabs", codelabId, "submissions", page, pageSize],
    queryFn: () =>
      apiFetch<PaginatedCodeLabSubmissions>(`/v1/codelabs/${codelabId}/submissions/all?page=${page}&page_size=${pageSize}`),
    enabled: Boolean(codelabId),
  });
}

export type ExamQuestionType = "single" | "multi" | "fill" | "short" | "proof";
export type ExamStatus = "draft" | "published" | "closed";
export type ExamAttemptStatus = "in_progress" | "submitted" | "pending_review" | "graded" | "expired";
export type ExamResultPolicy = "after_submit" | "after_end" | "manual";
export type ExamAnswerValue = string | string[] | Record<string, unknown> | null;

export interface ExamQuestionOption {
  id: string;
  label: string;
  content: string;
}

export interface ExamQuestion {
  id: string;
  course_id: string;
  chapter_id: string | null;
  teacher_id: string | null;
  type: ExamQuestionType;
  content: string;
  options: ExamQuestionOption[] | null;
  answer: ExamAnswerValue;
  explanation: string | null;
  difficulty: number;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExamQuestionInput {
  course_id: string;
  chapter_id?: string | null;
  type: ExamQuestionType;
  content: string;
  options?: ExamQuestionOption[] | null;
  answer: ExamAnswerValue;
  explanation?: string | null;
  difficulty: number;
  tags: string[];
}

export interface ExamQuestionInPaperInput {
  question_id: string;
  points: number;
  order_index: number;
}

export interface ExamQuestionInPaper {
  id: string;
  question_id: string;
  points: number;
  order_index: number;
  question: ExamQuestion;
}

export interface ExamAttemptSummary {
  id: string;
  status: ExamAttemptStatus;
  score: number | null;
  total_score: number;
  submitted_at: string | null;
  graded_at: string | null;
}

export interface ExamListItem {
  id: string;
  title: string;
  course_id: string;
  course_title: string | null;
  chapter_id: string | null;
  chapter_title: string | null;
  status: ExamStatus;
  total_score: number;
  pass_score: number;
  time_limit_minutes: number;
  start_time: string | null;
  end_time: string | null;
  question_count: number;
  attempt_status: ExamAttemptStatus | null;
  best_score: number | null;
  latest_attempt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  course_id: string;
  course_title: string | null;
  chapter_id: string | null;
  chapter_title: string | null;
  teacher_id: string | null;
  status: ExamStatus;
  total_score: number;
  pass_score: number;
  time_limit_minutes: number;
  start_time: string | null;
  end_time: string | null;
  max_attempts: number;
  is_shuffled: boolean;
  show_result_policy: ExamResultPolicy;
  questions: ExamQuestionInPaper[];
  latest_attempt: ExamAttemptSummary | null;
  created_at: string;
  updated_at: string;
}

export interface ExamInput {
  course_id: string;
  chapter_id?: string | null;
  title: string;
  description?: string | null;
  total_score: number;
  pass_score?: number | null;
  time_limit_minutes: number;
  start_time?: string | null;
  end_time?: string | null;
  max_attempts: number;
  is_shuffled: boolean;
  show_result_policy: ExamResultPolicy;
  questions: ExamQuestionInPaperInput[];
  status: ExamStatus;
}

export interface AttemptStartResponse {
  attempt_id: string;
  exam_id: string;
  status: ExamAttemptStatus;
  questions: ExamQuestionInPaper[];
  time_limit_minutes: number;
  started_at: string;
  deadline_at: string | null;
  saved_answers: Record<string, ExamAnswerValue>;
}

export interface AttemptAnswerResult {
  question_id: string;
  user_answer: ExamAnswerValue;
  is_correct: boolean | null;
  score: number | null;
  max_score: number;
  standard_answer: ExamAnswerValue;
  explanation: string | null;
  teacher_comment: string | null;
  pending_review: boolean;
}

export interface AttemptResult {
  attempt_id: string;
  exam_id: string;
  status: ExamAttemptStatus;
  score: number | null;
  auto_score: number;
  manual_score: number;
  total_score: number;
  pass_score: number;
  submitted_at: string | null;
  graded_at: string | null;
  can_view_detail: boolean;
  answers: AttemptAnswerResult[];
}

export interface ExamAttemptListItem {
  id: string;
  exam_id: string;
  user_id: string;
  student_name: string | null;
  status: ExamAttemptStatus;
  score: number | null;
  auto_score: number;
  manual_score: number;
  total_score: number;
  violation_count: number;
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
}

export interface ExamStats {
  participants_count: number;
  submitted_count: number;
  pending_review_count: number;
  avg_score: number | null;
  pass_rate: number | null;
  max_score: number | null;
  min_score: number | null;
  score_distribution: Array<{ label: string; count: number }>;
  question_stats: Array<{
    question_id: string;
    content: string;
    type: ExamQuestionType;
    max_score: number;
    answered_count: number;
    correct_rate: number | null;
    avg_score: number | null;
    pending_review_count: number;
  }>;
}

export interface ExamFilters {
  course_id?: string;
  chapter_id?: string;
  status?: ExamStatus;
  q?: string;
}

export interface ExamQuestionFilters {
  course_id?: string;
  chapter_id?: string;
  type?: ExamQuestionType;
  difficulty?: number;
  q?: string;
}

export interface PaginatedExams {
  data: ExamListItem[];
  meta: { page: number; page_size: number; total: number };
}

export interface PaginatedExamQuestions {
  data: ExamQuestion[];
  meta: { page: number; page_size: number; total: number };
}

export interface PaginatedExamAttempts {
  data: ExamAttemptListItem[];
  meta: { page: number; page_size: number; total: number };
}

function buildExamParams(filters: ExamFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (filters.course_id) params.set("course_id", filters.course_id);
  if (filters.chapter_id) params.set("chapter_id", filters.chapter_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  return params.toString();
}

function buildExamQuestionParams(filters: ExamQuestionFilters, page: number, pageSize: number): string {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (filters.course_id) params.set("course_id", filters.course_id);
  if (filters.chapter_id) params.set("chapter_id", filters.chapter_id);
  if (filters.type) params.set("type", filters.type);
  if (filters.difficulty) params.set("difficulty", String(filters.difficulty));
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  return params.toString();
}

export function useExams(filters: ExamFilters, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ["exams", filters, page, pageSize],
    queryFn: () => apiFetch<PaginatedExams>(`/v1/exams?${buildExamParams(filters, page, pageSize)}`),
  });
}

export function useExam(id?: string) {
  return useQuery({
    queryKey: ["exams", id],
    queryFn: () => apiFetch<Exam>(`/v1/exams/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExamInput) =>
      apiFetch<Exam>("/v1/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ExamInput> }) =>
      apiFetch<Exam>(`/v1/exams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: (exam) => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["exams", exam.id] });
    },
  });
}

export function usePublishExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Exam>(`/v1/exams/${id}/publish`, { method: "PATCH" }),
    onSuccess: (exam) => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["exams", exam.id] });
    },
  });
}

export function useCloseExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Exam>(`/v1/exams/${id}/close`, { method: "PATCH" }),
    onSuccess: (exam) => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["exams", exam.id] });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/exams/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
    },
  });
}

export function useExamQuestions(filters: ExamQuestionFilters, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ["exam-questions", filters, page, pageSize],
    queryFn: () => apiFetch<PaginatedExamQuestions>(`/v1/exams/questions?${buildExamQuestionParams(filters, page, pageSize)}`),
  });
}

export function useCreateExamQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExamQuestionInput) =>
      apiFetch<ExamQuestion>("/v1/exams/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
    },
  });
}

export function useUpdateExamQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ExamQuestionInput> }) =>
      apiFetch<ExamQuestion>(`/v1/exams/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
    },
  });
}

export function useDeleteExamQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/v1/exams/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-questions"] });
    },
  });
}

export function useStartExamAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => apiFetch<AttemptStartResponse>(`/v1/exams/${examId}/attempts`, { method: "POST" }),
    onSuccess: (_, examId) => {
      void queryClient.invalidateQueries({ queryKey: ["exams", examId] });
    },
  });
}

export function useSaveExamDraft() {
  return useMutation({
    mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Record<string, ExamAnswerValue> }) =>
      apiFetch<AttemptStartResponse>(`/v1/exams/attempts/${attemptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }),
  });
}

export function useExamAttempt(attemptId?: string) {
  return useQuery({
    queryKey: ["exam-attempt", attemptId],
    queryFn: () => apiFetch<AttemptStartResponse>(`/v1/exams/attempts/${attemptId}`),
    enabled: Boolean(attemptId),
  });
}

export function useSubmitExamAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Record<string, ExamAnswerValue> }) =>
      apiFetch<AttemptResult>(`/v1/exams/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["exams"] });
      void queryClient.invalidateQueries({ queryKey: ["exams", result.exam_id] });
      void queryClient.invalidateQueries({ queryKey: ["exam-result", result.attempt_id] });
    },
  });
}

export function useExamResult(attemptId?: string) {
  return useQuery({
    queryKey: ["exam-result", attemptId],
    queryFn: () => apiFetch<AttemptResult>(`/v1/exams/attempts/${attemptId}/result`),
    enabled: Boolean(attemptId),
  });
}

export function useReportExamViolation() {
  return useMutation({
    mutationFn: ({ attemptId, reason }: { attemptId: string; reason: string }) =>
      apiFetch<AttemptStartResponse>(`/v1/exams/attempts/${attemptId}/violations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
  });
}

export function useExamAttempts(examId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["exam-attempts", examId, page, pageSize],
    queryFn: () => apiFetch<PaginatedExamAttempts>(`/v1/exams/${examId}/attempts?page=${page}&page_size=${pageSize}`),
    enabled: Boolean(examId),
  });
}

export function usePendingReviews(examId?: string, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ["exam-reviews", examId, page, pageSize],
    queryFn: () => apiFetch<PaginatedExamAttempts>(`/v1/exams/${examId}/reviews?page=${page}&page_size=${pageSize}`),
    enabled: Boolean(examId),
  });
}

export function useGradeExamAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, answers }: { attemptId: string; answers: Array<{ question_id: string; score: number; teacher_comment?: string | null }> }) =>
      apiFetch<AttemptResult>(`/v1/exams/attempts/${attemptId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["exam-attempts", result.exam_id] });
      void queryClient.invalidateQueries({ queryKey: ["exam-reviews", result.exam_id] });
      void queryClient.invalidateQueries({ queryKey: ["exam-stats", result.exam_id] });
      void queryClient.invalidateQueries({ queryKey: ["exam-result", result.attempt_id] });
    },
  });
}

export function useExamStats(examId?: string) {
  return useQuery({
    queryKey: ["exam-stats", examId],
    queryFn: () => apiFetch<ExamStats>(`/v1/exams/${examId}/stats`),
    enabled: Boolean(examId),
  });
}
