import { Link, useNavigate, useParams } from "react-router-dom";

import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import { useExam, useStartExamAttempt } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function ExamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const examQuery = useExam(id);
  const startMutation = useStartExamAttempt();

  if (examQuery.isLoading) return <p className="text-sm text-muted-foreground">测验加载中...</p>;
  if (examQuery.isError || !examQuery.data) {
    return <p className="text-sm text-destructive">{examQuery.error instanceof Error ? examQuery.error.message : "测验加载失败"}</p>;
  }

  const exam = examQuery.data;
  const canManage = user?.role === "teacher" || user?.role === "admin";
  const now = Date.now();
  const startsAt = exam.start_time ? new Date(exam.start_time).getTime() : null;
  const endsAt = exam.end_time ? new Date(exam.end_time).getTime() : null;
  const notStarted = startsAt !== null && now < startsAt;
  const ended = exam.status === "closed" || (endsAt !== null && now > endsAt);
  const canStart = user?.role === "student" && exam.status === "published" && !notStarted && !ended;

  const handleStart = () => {
    if (!id) return;
    startMutation.mutate(id, {
      onSuccess: (attempt) => navigate(`/exam/${id}/attempt/${attempt.attempt_id}`),
    });
  };

  return (
    <section className="space-y-4">
      <nav className="text-sm text-muted-foreground">
        <Link to="/exam" className="hover:text-primary">
          在线测验
        </Link>
        <span className="mx-2">/</span>
        <span>{exam.title}</span>
      </nav>

      <div className="rounded-md border border-border bg-surface p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{exam.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {exam.course_title ?? "未关联课程"} {exam.chapter_title ? `/ ${exam.chapter_title}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <>
                <Link to={`/exam/${exam.id}/edit`} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                  编辑
                </Link>
                <Link to={`/exam/${exam.id}/reviews`} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                  批阅
                </Link>
                <Link to={`/exam/${exam.id}/stats`} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                  统计
                </Link>
              </>
            ) : null}
            {exam.latest_attempt ? (
              <Link
                to={`/exam/${exam.id}/result/${exam.latest_attempt.id}`}
                className="rounded-md border border-primary px-3 py-2 text-sm text-primary hover:bg-primary/10"
              >
                查看结果
              </Link>
            ) : null}
            {user?.role === "student" ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={!canStart || startMutation.isPending}
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {exam.latest_attempt?.status === "in_progress" ? "继续答题" : "开始答题"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
          <span className="rounded bg-muted px-3 py-2">状态：{exam.status === "draft" ? "草稿" : exam.status === "closed" ? "已关闭" : "已发布"}</span>
          <span className="rounded bg-muted px-3 py-2">满分：{exam.total_score}</span>
          <span className="rounded bg-muted px-3 py-2">及格：{exam.pass_score}</span>
          <span className="rounded bg-muted px-3 py-2">限时：{exam.time_limit_minutes} 分钟</span>
        </div>

        {notStarted ? <p className="mt-3 text-sm text-amber-700">测验尚未开始。</p> : null}
        {ended ? <p className="mt-3 text-sm text-muted-foreground">测验已结束或关闭。</p> : null}
        {startMutation.isError ? (
          <p className="mt-3 text-sm text-destructive">{startMutation.error instanceof Error ? startMutation.error.message : "无法开始答题"}</p>
        ) : null}
      </div>

      <div className="rounded-md border border-border bg-surface p-5">
        <h2 className="mb-3 font-semibold">测验说明</h2>
        <MarkdownRenderer content={exam.description || "暂无说明。"} />
      </div>

      {canManage ? (
        <div className="rounded-md border border-border bg-surface p-5">
          <h2 className="mb-3 font-semibold">题目预览</h2>
          <div className="space-y-2">
            {exam.questions.map((item, index) => (
              <div key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="mb-1 flex justify-between gap-2">
                  <span>第 {index + 1} 题 · {item.question.type} · {item.points} 分</span>
                  <span className="text-muted-foreground">难度 {item.question.difficulty}</span>
                </div>
                <MarkdownRenderer content={item.question.content} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
