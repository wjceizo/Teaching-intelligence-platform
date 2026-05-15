import { useState } from "react";

import { CodeLabSubmission } from "../../lib/api";
import { SubmissionHistory } from "./SubmissionHistory";

interface ConsolePanelProps {
  activeSubmission: CodeLabSubmission | null;
  submissions: CodeLabSubmission[];
  loadingHistory: boolean;
}

type ConsoleTab = "output" | "tests" | "history";

function statusLabel(status: CodeLabSubmission["status"]) {
  const labels: Record<CodeLabSubmission["status"], string> = {
    pending: "等待中",
    running: "运行中",
    success: "通过",
    failed: "未通过",
    error: "错误",
    timeout: "超时",
  };
  return labels[status];
}

export function ConsolePanel({ activeSubmission, submissions, loadingHistory }: ConsolePanelProps) {
  const [tab, setTab] = useState<ConsoleTab>("tests");
  const scorePercent =
    activeSubmission && activeSubmission.max_score > 0
      ? Math.round((activeSubmission.score / activeSubmission.max_score) * 100)
      : 0;
  const hiddenSummaryResults =
    activeSubmission?.results.filter(
      (result) =>
        result.is_hidden &&
        result.input_data === null &&
        result.expected_output === null &&
        result.actual_output === null
    ) ?? [];
  const detailedResults =
    activeSubmission?.results.filter((result) => !hiddenSummaryResults.includes(result)) ?? [];

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex overflow-x-auto border-b border-border">
        {(["output", "tests", "history"] as ConsoleTab[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`shrink-0 px-4 py-2 text-sm ${tab === item ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item === "output" ? "输出" : item === "tests" ? "测试结果" : "提交历史"}
          </button>
        ))}
      </div>

      <div className="min-h-[220px] p-4">
        {tab === "output" ? (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black p-3 font-mono text-sm text-white">
            {activeSubmission?.logs || activeSubmission?.results.map((item) => item.actual_output).filter(Boolean).join("\n") || "暂无输出"}
          </pre>
        ) : null}

        {tab === "tests" ? (
          <div className="space-y-3">
            {activeSubmission ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {statusLabel(activeSubmission.status)} / {activeSubmission.score}/{activeSubmission.max_score}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {activeSubmission.tests_passed}/{activeSubmission.tests_total} 个用例通过
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${scorePercent}%` }} />
                </div>
                <div className="space-y-2">
                  {hiddenSummaryResults.length > 0 ? (
                    <div className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">隐藏用例</span>
                        <span className="text-xs text-muted-foreground">
                          通过 {hiddenSummaryResults.filter((result) => result.passed).length}/{hiddenSummaryResults.length}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">隐藏用例只显示通过数量，不展示单个用例结果。</p>
                    </div>
                  ) : null}
                  {detailedResults.map((result) => (
                    <div key={`${result.test_case_id}-${result.name}`} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {result.is_hidden ? "隐藏用例" : result.name}
                        </span>
                        <span className={`text-xs ${result.passed ? "text-success" : "text-destructive"}`}>
                          {result.passed ? "通过" : "失败"} / {result.points} 分
                        </span>
                      </div>
                      {result.is_hidden ? (
                        <p className="mt-2 text-xs text-muted-foreground">隐藏用例内容不会向学生公开。</p>
                      ) : (
                        <div className="mt-2 grid gap-2 text-xs md:grid-cols-3">
                          <pre className="overflow-auto rounded bg-muted p-2">输入{"\n"}{result.input_data ?? ""}</pre>
                          <pre className="overflow-auto rounded bg-muted p-2">期望{"\n"}{result.expected_output ?? ""}</pre>
                          <pre className="overflow-auto rounded bg-muted p-2">实际{"\n"}{result.actual_output ?? ""}</pre>
                        </div>
                      )}
                      {result.error ? <p className="mt-2 text-xs text-destructive">{result.error}</p> : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">运行或提交后会在这里显示测试结果。</p>
            )}
          </div>
        ) : null}

        {tab === "history" ? (
          <SubmissionHistory submissions={submissions} isLoading={loadingHistory} />
        ) : null}
      </div>
    </div>
  );
}
