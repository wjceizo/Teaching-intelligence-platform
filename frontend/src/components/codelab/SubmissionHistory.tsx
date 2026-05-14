import { useState } from "react";

import { CodeLabSubmission } from "../../lib/api";

interface SubmissionHistoryProps {
  submissions: CodeLabSubmission[];
  isLoading: boolean;
}

const statusClass: Record<CodeLabSubmission["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-info-surface text-info",
  success: "bg-success-surface text-success",
  failed: "bg-destructive-surface text-destructive",
  error: "bg-destructive-surface text-destructive",
  timeout: "bg-warning-surface text-warning",
};

const statusText: Record<CodeLabSubmission["status"], string> = {
  pending: "等待",
  running: "运行中",
  success: "通过",
  failed: "未通过",
  error: "错误",
  timeout: "超时",
};

export function SubmissionHistory({ submissions, isLoading }: SubmissionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">提交历史加载中...</p>;
  }

  if (!submissions.length) {
    return <p className="text-sm text-muted-foreground">暂无提交记录。</p>;
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
            <span className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs ${statusClass[submission.status]}`}>{statusText[submission.status]}</span>
              <span>
                {submission.mode} / {submission.score}/{submission.max_score}
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
