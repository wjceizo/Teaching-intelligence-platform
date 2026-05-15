import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ExamFilters, ExamStatus, useCourses, useExams } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

function statusLabel(status: ExamStatus, attemptStatus: string | null): string {
  if (attemptStatus === "pending_review") return "待批阅";
  if (attemptStatus === "graded") return "已完成";
  if (status === "draft") return "草稿";
  if (status === "closed") return "已关闭";
  return "进行中";
}

export function ExamListPage() {
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [filters, setFilters] = useState<ExamFilters>({});
  const examsQuery = useExams(filters, page, 12);
  const coursesQuery = useCourses(1, 100);
  const canManage = user?.role === "teacher" || user?.role === "admin";
  const selectableCourses =
    coursesQuery.data?.data.filter((course) => user?.role !== "student" || course.is_enrolled) ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: searchDraft || undefined }));
      setPage(1);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">在线测验</h1>
          <p className="text-sm text-muted-foreground">参加课程测验，自动保存答题进度并查看批阅结果。</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Link to="/exam/manage" className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted">
              管理测验
            </Link>
            <Link to="/exam/questions" className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted">
              题库
            </Link>
            <Link to="/exam/new" className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted">
              新建测验
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-4">
        <input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="搜索测验"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={filters.course_id ?? ""}
          onChange={(event) => {
            setFilters((current) => ({ ...current, course_id: event.target.value || undefined }));
            setPage(1);
          }}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">全部课程</option>
          {selectableCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        {canManage ? (
          <select
            value={filters.status ?? ""}
            onChange={(event) => {
              setFilters((current) => ({ ...current, status: (event.target.value as ExamStatus) || undefined }));
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="closed">已关闭</option>
          </select>
        ) : null}
      </div>

      {examsQuery.isLoading ? <p className="text-sm text-muted-foreground">测验加载中...</p> : null}
      {examsQuery.isError ? (
        <p className="text-sm text-destructive">{examsQuery.error instanceof Error ? examsQuery.error.message : "加载失败"}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {examsQuery.data?.data.map((item) => (
          <Link key={item.id} to={`/exam/${item.id}`} className="rounded-md border border-border bg-surface p-4 hover:border-primary">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.course_title ?? "未关联课程"} {item.chapter_title ? `/ ${item.chapter_title}` : ""}
                </p>
              </div>
              <span className={`rounded px-2 py-1 text-xs ${item.status === "draft" ? "text-destructive" : "bg-muted"}`}>
                {statusLabel(item.status, item.attempt_status)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{item.question_count} 题</span>
              <span>满分 {item.total_score}</span>
              <span>限时 {item.time_limit_minutes} 分钟</span>
              {item.best_score !== null ? <span className="text-primary">最高 {item.best_score}</span> : null}
            </div>
          </Link>
        ))}
      </div>
      {examsQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">暂无测验。</p> : null}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={page === 1}
          className="rounded-md border border-border bg-surface px-3 py-1 text-sm disabled:opacity-50"
        >
          上一页
        </button>
        <span className="text-sm">第 {page} 页</span>
        <button
          type="button"
          onClick={() => setPage((value) => value + 1)}
          disabled={!examsQuery.data || page * examsQuery.data.meta.page_size >= examsQuery.data.meta.total}
          className="rounded-md border border-border bg-surface px-3 py-1 text-sm disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </section>
  );
}
