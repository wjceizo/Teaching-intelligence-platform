import { Question } from "../../lib/api";

interface QuestionCardProps {
  question: Question;
  onClick: (questionId: string) => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function QuestionCard({ question, onClick }: QuestionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(question.id)}
      className="w-full rounded-xl border border-border bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {question.is_pinned ? <span className="text-sm text-warning">置顶</span> : null}
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            question.type === "ai" ? "bg-info-surface text-info" : "bg-success-surface text-success"
          }`}
        >
          {question.type === "ai" ? "AI 答疑" : "教师答疑"}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            question.status === "resolved" ? "bg-muted text-muted-foreground" : "bg-warning-surface text-warning"
          }`}
        >
          {question.status === "resolved" ? "已解决" : "未解决"}
        </span>
        <span className="rounded bg-info-surface px-2 py-0.5 text-xs text-info">
          {question.course_title ?? "课程"}
        </span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {question.chapter_title ?? "全课程"}
        </span>
      </div>

      <h3 className="mb-2 text-base font-semibold">{question.title}</h3>
      <p className="mb-3 line-clamp-2 text-sm text-foreground/80">{question.content}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{question.user.username}</span>
        <span>{formatDateTime(question.created_at)}</span>
        <span>{question.answers_count} 条回答</span>
        <span>{question.view_count} 次浏览</span>
      </div>
    </button>
  );
}
