import { useHealth } from "../lib/api";

export function DashboardPage() {
  const { data, isLoading, isError, error } = useHealth();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">学习仪表盘</h1>

      <div className="rounded-lg border border-border bg-background p-4">
        <h2 className="mb-2 font-medium">后端健康检查</h2>
        {isLoading ? <p className="text-sm text-foreground/70">加载中...</p> : null}
        {isError ? (
          <p className="text-sm text-red-600">请求失败：{error instanceof Error ? error.message : "未知错误"}</p>
        ) : null}
        {data ? (
          <p className="text-sm">
            状态：<span className="font-medium">{data.data.status}</span>，版本：
            <span className="font-medium">{data.data.version}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
