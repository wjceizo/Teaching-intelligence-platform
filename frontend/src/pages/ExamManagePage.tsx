import { useState } from "react";
import { Link } from "react-router-dom";

import { ExamFilters, ExamStatus, useCloseExam, useDeleteExam, useExams, usePublishExam } from "../lib/api";

export function ExamManagePage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ExamFilters>({});
  const examsQuery = useExams(filters, page, 20);
  const publishMutation = usePublishExam();
  const closeMutation = useCloseExam();
  const deleteMutation = useDeleteExam();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">管理测验</h1>
          <p className="text-sm text-muted-foreground">发布试卷、查看提交、批阅主观题和查看统计。</p>
        </div>
        <Link to="/exam/new" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          新建测验
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-surface p-3">
        <input
          value={filters.q ?? ""}
          onChange={(event) => {
            setFilters((current) => ({ ...current, q: event.target.value || undefined }));
            setPage(1);
          }}
          placeholder="搜索测验"
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
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
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">课程</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">总分</th>
              <th className="px-3 py-2">题数</th>
              <th className="px-3 py-2">限时</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {examsQuery.data?.data.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{item.title}</td>
                <td className="px-3 py-2">{item.course_title ?? "-"}</td>
                <td className={`px-3 py-2 ${item.status === "draft" ? "font-semibold text-destructive" : ""}`}>
                  {item.status === "draft" ? "草稿" : item.status === "published" ? "已发布" : "已关闭"}
                </td>
                <td className="px-3 py-2">{item.total_score}</td>
                <td className="px-3 py-2">{item.question_count}</td>
                <td className="px-3 py-2">{item.time_limit_minutes} 分钟</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/exam/${item.id}/edit`} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">编辑</Link>
                    <Link to={`/exam/${item.id}/reviews`} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">批阅</Link>
                    <Link to={`/exam/${item.id}/stats`} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">统计</Link>
                    {item.status !== "published" ? (
                      <button type="button" onClick={() => publishMutation.mutate(item.id)} className="rounded border border-border px-2 py-1 text-xs">
                        发布
                      </button>
                    ) : (
                      <button type="button" onClick={() => closeMutation.mutate(item.id)} className="rounded border border-border px-2 py-1 text-xs">
                        关闭
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => window.confirm("确认删除该测验？已有提交时会自动关闭。") && deleteMutation.mutate(item.id)}
                      className="rounded border border-destructive px-2 py-1 text-xs text-destructive"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {examsQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">暂无测验。</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border px-3 py-1 text-sm disabled:opacity-50">
          上一页
        </button>
        <button
          type="button"
          disabled={!examsQuery.data || page * examsQuery.data.meta.page_size >= examsQuery.data.meta.total}
          onClick={() => setPage((value) => value + 1)}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </section>
  );
}
