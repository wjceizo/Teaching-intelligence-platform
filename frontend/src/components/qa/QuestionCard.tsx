import { Question } from "../../lib/api";

interface QuestionCardProps {
  question: Question;
  onClick: (questionId: string) => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function pickCourseColor(courseId: string): string {
  const palette = [
    "bg-rose-100 text-rose-700",
    "bg-orange-100 text-orange-700",
    "bg-lime-100 text-lime-700",
    "bg-emerald-100 text-emerald-700",
    "bg-teal-100 text-teal-700",
    "bg-cyan-100 text-cyan-700",
    "bg-indigo-100 text-indigo-700",
  ];
  let hash = 0;
  for (let index = 0; index < courseId.length; index += 1) {
    hash = (hash * 31 + courseId.charCodeAt(index)) >>> 0;
  }
  return palette[hash % palette.length];
}

export function QuestionCard({ question, onClick }: QuestionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(question.id)}
      className="w-full rounded-xl border border-border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {question.is_pinned ? <span className="text-sm text-amber-600">📌 置顶</span> : null}
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            question.type === "ai" ? "bg-cyan-100 text-cyan-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {question.type === "ai" ? "AI答疑" : "教师答疑"}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            question.status === "resolved" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {question.status === "resolved" ? "已解决" : "未解决"}
        </span>
        <span className={`rounded px-2 py-0.5 text-xs ${pickCourseColor(question.course_id)}`}>
          {question.course_title ?? "课程"}
        </span>
        <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
          {question.chapter_title ?? "全课程"}
        </span>
      </div>

      <h3 className="mb-2 text-base font-semibold">{question.title}</h3>
      <p className="mb-3 line-clamp-2 text-sm text-foreground/80">{question.content}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/70">
        <span>{question.user.username}</span>
        <span>{formatDateTime(question.created_at)}</span>
        <span>{question.answers_count} 条回答</span>
        <span>{question.view_count} 次浏览</span>
      </div>
    </button>
  );
}
