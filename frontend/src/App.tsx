import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { ApiError, useMe } from "./lib/api";
import { CodeLabDetailPage } from "./pages/CodeLabDetailPage";
import { CodeLabEditorPage } from "./pages/CodeLabEditorPage";
import { CodeLabListPage } from "./pages/CodeLabListPage";
import { CodeLabManagePage } from "./pages/CodeLabManagePage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { CourseEditorPage } from "./pages/CourseEditorPage";
import { CourseListPage } from "./pages/CourseListPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamDetailPage } from "./pages/ExamDetailPage";
import { ExamEditorPage } from "./pages/ExamEditorPage";
import { ExamListPage } from "./pages/ExamListPage";
import { ExamManagePage } from "./pages/ExamManagePage";
import { ExamPage } from "./pages/ExamPage";
import { ExamResultPage } from "./pages/ExamResultPage";
import { ExamReviewPage } from "./pages/ExamReviewPage";
import { ExamStatsPage } from "./pages/ExamStatsPage";
import { LoginPage } from "./pages/LoginPage";
import { NotesPage } from "./pages/NotesPage";
import { QACenterPage } from "./pages/QACenterPage";
import { QuestionDetailPage } from "./pages/QuestionDetailPage";
import { QuestionBankPage } from "./pages/QuestionBankPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SharedNotePage } from "./pages/SharedNotePage";
import { useAuthStore } from "./stores/authStore";

interface PlaceholderPageProps {
  title: string;
}

function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-foreground/70">该模块将在后续 Phase 实现。</p>
    </section>
  );
}

function AuthBootstrap() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const token = useAuthStore((state) => state.token);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const meQuery = useMe(hasHydrated && Boolean(token));

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    setUser({
      id: meQuery.data.id,
      name: meQuery.data.username,
      role: meQuery.data.role,
    });
  }, [meQuery.data, setUser]);

  useEffect(() => {
    const shouldLogout =
      meQuery.error instanceof ApiError &&
      meQuery.error.status === 401 &&
      hasHydrated &&
      Boolean(token);

    if (shouldLogout) {
      logout();
    }
  }, [hasHydrated, token, meQuery.error, logout]);

  useEffect(() => {
    if (!hasHydrated || !token || typeof window === "undefined") {
      return;
    }

    const rawAuthStorage = window.localStorage.getItem("auth-storage");
    if (!rawAuthStorage) {
      logout();
      return;
    }

    try {
      const parsed = JSON.parse(rawAuthStorage) as {
        state?: { token?: string | null };
      };
      const persistedToken = parsed.state?.token ?? null;
      if (!persistedToken) {
        logout();
      }
    } catch {
      logout();
    }
  }, [hasHydrated, token, location.key, logout]);

  return null;
}

function ProtectedRoute() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);

  if (!hasHydrated) {
    return null;
  }
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function GuestRoute() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);

  if (!hasHydrated) {
    return null;
  }
  if (isAuthenticated && token) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

interface RoleRouteProps {
  allowedRoles: Array<"student" | "teacher" | "admin">;
}

function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <>
      <AuthBootstrap />
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/courses" element={<CourseListPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/courses/:id/chapters/:chapterId" element={<CourseDetailPage />} />
            <Route path="/qa" element={<QACenterPage />} />
            <Route path="/qa/:id" element={<QuestionDetailPage />} />

            <Route element={<RoleRoute allowedRoles={["teacher", "admin"]} />}>
              <Route path="/courses/:id/edit" element={<CourseEditorPage />} />
              <Route path="/qa/manage" element={<PlaceholderPage title="教师答疑管理" />} />
              <Route path="/codelab/manage" element={<CodeLabManagePage />} />
              <Route path="/codelab/new" element={<CodeLabEditorPage />} />
              <Route path="/codelab/:id/edit" element={<CodeLabEditorPage />} />
              <Route path="/exam/manage" element={<ExamManagePage />} />
              <Route path="/exam/questions" element={<QuestionBankPage />} />
              <Route path="/exam/new" element={<ExamEditorPage />} />
              <Route path="/exam/:id/edit" element={<ExamEditorPage />} />
              <Route path="/exam/:id/reviews" element={<ExamReviewPage />} />
              <Route path="/exam/:id/stats" element={<ExamStatsPage />} />
            </Route>

            <Route path="/notes" element={<NotesPage />} />
            <Route path="/notes/shared/:token" element={<SharedNotePage />} />
            <Route path="/codelab" element={<CodeLabListPage />} />
            <Route path="/codelab/:id" element={<CodeLabDetailPage />} />
            <Route path="/exam" element={<ExamListPage />} />
            <Route path="/exam/:id" element={<ExamDetailPage />} />
            <Route path="/exam/:id/attempt/:attemptId" element={<ExamPage />} />
            <Route path="/exam/:id/result/:attemptId" element={<ExamResultPage />} />
            <Route path="/forbidden" element={<PlaceholderPage title="无权限访问该页面" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
