import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { CodeLabFilters, useCodeLabs, useCourses } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function CodeLabListPage() {
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [filters, setFilters] = useState<CodeLabFilters>({});
  const codelabsQuery = useCodeLabs(filters, page, 12);
  const coursesQuery = useCourses(1, 100);
  const selectableCourses =
    coursesQuery.data?.data.filter((course) => user?.role !== "student" || course.is_enrolled) ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({ ...current, q: searchDraft || undefined }));
      setPage(1);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const canManage = user?.role === "teacher" || user?.role === "admin";

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">代码实训</h1>
          <p className="text-sm text-muted-foreground">按课程章节练习编程题，运行样例并提交评分。</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Link to="/codelab/manage" className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted">
              管理题目
            </Link>
            <Link to="/codelab/new" className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted">
              新建题目
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-md border border-border bg-surface p-3 md:grid-cols-5">
        <input
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="搜索题目"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={filters.course_id ?? ""}
          onChange={(event) => {
            setFilters((current) => ({ ...current, course_id: event.target.value || undefined, chapter_id: undefined }));
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
        <select
          value={filters.language ?? ""}
          onChange={(event) => {
            const value = event.target.value as CodeLabFilters["language"] | "";
            setFilters((current) => ({ ...current, language: value || undefined }));
            setPage(1);
          }}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">全部语言</option>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="cpp">C++</option>
        </select>
        <select
          value={filters.difficulty ?? ""}
          onChange={(event) => {
            setFilters((current) => ({ ...current, difficulty: event.target.value ? Number(event.target.value) : undefined }));
            setPage(1);
          }}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="">全部难度</option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} 星
            </option>
          ))}
        </select>
      </div>

      {codelabsQuery.isLoading ? <p className="text-sm text-muted-foreground">实训题加载中...</p> : null}
      {codelabsQuery.isError ? (
        <p className="text-sm text-destructive">{codelabsQuery.error instanceof Error ? codelabsQuery.error.message : "加载失败"}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {codelabsQuery.data?.data.map((item) => (
          <Link key={item.id} to={`/codelab/${item.id}`} className="rounded-md border border-border bg-surface p-4 hover:border-primary">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {item.title}
                  {!item.is_published ? (
                    <span className="ml-2 text-xs font-normal italic text-success">（草稿，未发布）</span>
                  ) : null}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.course_title ?? "未关联课程"} {item.chapter_title ? `/ ${item.chapter_title}` : ""}
                </p>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs uppercase">{item.language}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{"★".repeat(item.difficulty)}{"☆".repeat(5 - item.difficulty)}</span>
              <span>满分 {item.max_score}</span>
              <span>提交 {item.submissions_count}</span>
              {item.best_score !== null ? <span className="text-primary">最高 {item.best_score}</span> : null}
              {item.latest_submission?.status === "success" ? <span className="text-success">已完成</span> : null}
            </div>
          </Link>
        ))}
      </div>

      {codelabsQuery.data && codelabsQuery.data.data.length === 0 ? <p className="text-sm text-muted-foreground">暂无实训题。</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
          disabled={page === 1}
          className="rounded-md border border-border bg-surface px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
        >
          上一页
        </button>
        <span className="text-sm">第 {page} 页</span>
        <button
          type="button"
          onClick={() => setPage((value) => value + 1)}
          disabled={!codelabsQuery.data || page * codelabsQuery.data.meta.page_size >= codelabsQuery.data.meta.total}
          className="rounded-md border border-border bg-surface px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </section>
  );
}
