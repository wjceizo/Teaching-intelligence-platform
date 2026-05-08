import { Answer } from "../../lib/api";
import { MarkdownRenderer } from "../course/MarkdownRenderer";

interface AnswerItemProps {
  answer: Answer;
  votePending: boolean;
  onVote: (answerId: string, vote: -1 | 0 | 1) => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function AnswerItem({ answer, votePending, onVote }: AnswerItemProps) {
  const score = answer.upvotes - answer.downvotes;

  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center gap-2 text-xs">
        {answer.is_teacher ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">教师</span>
        ) : null}
        {answer.is_ai ? <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-700">AI</span> : null}
        <span className="text-foreground/70">{answer.user?.username ?? "匿名用户"}</span>
        <span className="text-foreground/70">{formatDateTime(answer.created_at)}</span>
      </div>

      <MarkdownRenderer content={answer.content} />

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={votePending}
          onClick={() => onVote(answer.id, answer.user_vote === 1 ? 0 : 1)}
          className={`rounded-md border px-2 py-1 text-sm ${
            answer.user_vote === 1 ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-border"
          }`}
        >
          👍 {answer.upvotes}
        </button>
        <button
          type="button"
          disabled={votePending}
          onClick={() => onVote(answer.id, answer.user_vote === -1 ? 0 : -1)}
          className={`rounded-md border px-2 py-1 text-sm ${
            answer.user_vote === -1 ? "border-rose-500 bg-rose-50 text-rose-700" : "border-border"
          }`}
        >
          👎 {answer.downvotes}
        </button>
        <span className="text-xs text-foreground/60">评分 {score >= 0 ? `+${score}` : score}</span>
      </div>
    </article>
  );
}
