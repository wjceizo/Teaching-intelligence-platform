import { useState } from "react";

import { CodeLabSubmission } from "../../lib/api";

interface SubmissionHistoryProps {
  submissions: CodeLabSubmission[];
  isLoading: boolean;
}

const statusClass: Record<CodeLabSubmission["status"], string> = {
  pending: "bg-slate-100 text-slate-700",
  running: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  error: "bg-orange-100 text-orange-700",
  timeout: "bg-purple-100 text-purple-700",
};

export function SubmissionHistory({ submissions, isLoading }: SubmissionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-foreground/70">提交历史加载中...</p>;
  }

  if (!submissions.length) {
    return <p className="text-sm text-foreground/70">暂无提交记录。</p>;
  }

  return (
    <div className="space-y-2">
      {submissions.map((submission) => (
        <div key={submission.id} className="rounded-md border border-border">
          <button
            type="button"
            onClick={() => setExpandedId((current) => (current === submission.id ? null : submission.id))}
            className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
          >
            <span>{new Date(submission.submitted_at).toLocaleString()}</span>
            <span className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs ${statusClass[submission.status]}`}>{submission.status}</span>
              <span>
                {submission.mode} · {submission.score}/{submission.max_score}
              </span>
              <span>{submission.execution_time_ms ?? 0} ms</span>
            </span>
          </button>
          {expandedId === submission.id ? (
            <div className="border-t border-border p-3">
              <pre className="max-h-56 overflow-auto rounded bg-black p-3 font-mono text-xs text-white">{submission.code}</pre>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
