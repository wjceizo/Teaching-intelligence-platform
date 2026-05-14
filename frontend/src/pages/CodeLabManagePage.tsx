import { useState } from "react";
import { Link } from "react-router-dom";

import { CodeLabFilters, useCodeLabs, useDeleteCodeLab, usePublishCodeLab } from "../lib/api";

export function CodeLabManagePage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<CodeLabFilters>({});
  const codelabsQuery = useCodeLabs(filters, page, 20);
  const publishMutation = usePublishCodeLab();
  const deleteMutation = useDeleteCodeLab();

  const handleDelete = (id: string) => {
    if (!window.confirm("确认删除该实训题？相关提交记录也会被删除。")) {
      return;
    }
    deleteMutation.mutate(id);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">实训题目管理</h1>
          <p className="text-sm text-foreground/70">维护题面、测试用例、发布状态和学生提交。</p>
        </div>
        <Link to="/codelab/new" className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          新建题目
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-background p-3">
        <input
          value={filters.q ?? ""}
          onChange={(event) => {
            setFilters((current) => ({ ...current, q: event.target.value || undefined }));
            setPage(1);
          }}
          placeholder="搜索题目"
          className="min-w-[220px] rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={typeof filters.is_published === "boolean" ? String(filters.is_published) : ""}
          onChange={(event) => {
            const value = event.target.value;
            setFilters((current) => ({
              ...current,
              is_published: value === "" ? undefined : value === "true",
            }));
            setPage(1);
          }}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">全部状态</option>
          <option value="true">已发布</option>
          <option value="false">草稿</option>
        </select>
      </div>

      {codelabsQuery.isError ? (
        <p className="text-sm text-red-600">{codelabsQuery.error instanceof Error ? codelabsQuery.error.message : "加载失败"}</p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border bg-background">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border bg-muted/60">
            <tr>
              <th className="px-3 py-2">标题</th>
              <th className="px-3 py-2">课程/章节</th>
              <th className="px-3 py-2">语言</th>
              <th className="px-3 py-2">难度</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">满分</th>
              <th className="px-3 py-2">提交</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {codelabsQuery.data?.data.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="px-3 py-2 font-medium">{item.title}</td>
                <td className="px-3 py-2 text-foreground/70">
                  {item.course_title ?? "-"} {item.chapter_title ? `· ${item.chapter_title}` : ""}
                </td>
                <td className="px-3 py-2 uppercase">{item.language}</td>
                <td className="px-3 py-2">{item.difficulty}</td>
                <td className="px-3 py-2">{item.is_published ? "已发布" : "草稿"}</td>
                <td className="px-3 py-2">{item.max_score}</td>
                <td className="px-3 py-2">{item.submissions_count}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/codelab/${item.id}`} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                      查看
                    </Link>
                    <Link to={`/codelab/${item.id}/edit`} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
                      编辑
                    </Link>
                    <button
                      type="button"
                      onClick={() => publishMutation.mutate({ id: item.id, is_published: !item.is_published })}
                      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                    >
                      {item.is_published ? "下架" : "发布"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {codelabsQuery.isLoading ? <p className="p-4 text-sm text-foreground/70">加载中...</p> : null}
        {codelabsQuery.data?.data.length === 0 ? <p className="p-4 text-sm text-foreground/70">暂无题目。</p> : null}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
          上一页
        </button>
        <button
          type="button"
          onClick={() => setPage((value) => value + 1)}
          disabled={!codelabsQuery.data || page * codelabsQuery.data.meta.page_size >= codelabsQuery.data.meta.total}
          className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </section>
  );
}
