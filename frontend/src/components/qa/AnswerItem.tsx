import { useState } from "react";

import { Answer } from "../../lib/api";
import { MarkdownRenderer } from "../course/MarkdownRenderer";

interface AnswerItemProps {
  answer: Answer;
  votePending: boolean;
  canManage: boolean;
  editPending: boolean;
  deletePending: boolean;
  onVote: (answerId: string, vote: -1 | 0 | 1) => void;
  onUpdate: (answerId: string, content: string) => void;
  onDelete: (answerId: string) => void;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function AnswerItem({
  answer,
  votePending,
  canManage,
  editPending,
  deletePending,
  onVote,
  onUpdate,
  onDelete,
}: AnswerItemProps) {
  const score = answer.upvotes - answer.downvotes;
  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(answer.content);

  return (
    <article className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        {answer.is_teacher ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">教师</span> : null}
        {answer.is_ai ? <span className="rounded bg-cyan-100 px-2 py-0.5 text-cyan-700">AI</span> : null}
        <span className="text-foreground/70">{answer.user?.username ?? "匿名用户"}</span>
        <span className="text-foreground/70">{formatDateTime(answer.created_at)}</span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={editPending || !draftContent.trim()}
              onClick={() => {
                onUpdate(answer.id, draftContent.trim());
                setEditing(false);
              }}
              className="rounded border border-border bg-surface px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraftContent(answer.content);
              }}
              className="rounded border border-border px-3 py-1 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <MarkdownRenderer content={answer.content} />
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
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

        {canManage ? (
          <>
            <button type="button" onClick={() => setEditing((previous) => !previous)} className="rounded border border-border px-2 py-1 text-xs">
              {editing ? "收起编辑" : "编辑回答"}
            </button>
            <button
              type="button"
              disabled={deletePending}
              onClick={() => onDelete(answer.id)}
              className="rounded border border-red-600 bg-red-50 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
            >
              删除回答
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
