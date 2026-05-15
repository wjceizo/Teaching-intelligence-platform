import { Link, useParams } from "react-router-dom";

import { useExam, useExamAttempts, useExamStats } from "../lib/api";

export function ExamStatsPage() {
  const { id } = useParams();
  const examQuery = useExam(id);
  const statsQuery = useExamStats(id);
  const attemptsQuery = useExamAttempts(id, 1, 50);

  if (statsQuery.isLoading) return <p className="text-sm text-muted-foreground">统计加载中...</p>;
  if (statsQuery.isError || !statsQuery.data) {
    return <p className="text-sm text-destructive">{statsQuery.error instanceof Error ? statsQuery.error.message : "统计加载失败"}</p>;
  }

  const stats = statsQuery.data;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">测验统计</h1>
          <p className="text-sm text-muted-foreground">{examQuery.data?.title ?? "班级作答数据"}</p>
        </div>
        {id ? <Link to={`/exam/${id}/reviews`} className="rounded-md border border-border px-3 py-2 text-sm">批阅</Link> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-border bg-surface p-4"><span className="text-sm text-muted-foreground">参与人数</span><strong className="block text-2xl">{stats.participants_count}</strong></div>
        <div className="rounded-md border border-border bg-surface p-4"><span className="text-sm text-muted-foreground">提交人数</span><strong className="block text-2xl">{stats.submitted_count}</strong></div>
        <div className="rounded-md border border-border bg-surface p-4"><span className="text-sm text-muted-foreground">平均分</span><strong className="block text-2xl">{stats.avg_score ?? "--"}</strong></div>
        <div className="rounded-md border border-border bg-surface p-4"><span className="text-sm text-muted-foreground">通过率</span><strong className="block text-2xl">{stats.pass_rate ?? "--"}%</strong></div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">分数分布</h2>
        <div className="space-y-2">
          {stats.score_distribution.map((bucket) => (
            <div key={bucket.label} className="grid grid-cols-[80px_1fr_40px] items-center gap-2 text-sm">
              <span>{bucket.label}</span>
              <div className="h-3 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, bucket.count * 20)}%` }} /></div>
              <span>{bucket.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">题目表现</h2>
        <div className="space-y-2">
          {stats.question_stats.map((item, index) => (
            <div key={item.question_id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span>第 {index + 1} 题 · {item.type} · {item.max_score} 分</span>
                <span>正确率 {item.correct_rate ?? "--"}% · 平均 {item.avg_score ?? "--"}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{item.content}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">学生</th><th className="px-3 py-2">状态</th><th className="px-3 py-2">分数</th><th className="px-3 py-2">违规</th><th className="px-3 py-2">提交时间</th></tr>
          </thead>
          <tbody>
            {attemptsQuery.data?.data.map((attempt) => (
              <tr key={attempt.id} className="border-t border-border">
                <td className="px-3 py-2">{attempt.student_name ?? attempt.user_id}</td>
                <td className="px-3 py-2">{attempt.status}</td>
                <td className="px-3 py-2">{attempt.score ?? "--"} / {attempt.total_score}</td>
                <td className="px-3 py-2">{attempt.violation_count}</td>
                <td className="px-3 py-2">{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
