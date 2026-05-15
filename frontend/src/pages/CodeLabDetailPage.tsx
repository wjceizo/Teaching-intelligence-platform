import confetti from "canvas-confetti";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { CodeEditor } from "../components/codelab/CodeEditor";
import { ConsolePanel } from "../components/codelab/ConsolePanel";
import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import { CodeLabSubmission, useCodeLab, useMyCodeSubmissions, useRunCode, useSubmitCode } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function CodeLabDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const codelabQuery = useCodeLab(id);
  const submissionsQuery = useMyCodeSubmissions(id, 1, 20);
  const runMutation = useRunCode();
  const submitMutation = useSubmitCode();
  const [code, setCode] = useState("");
  const [activeSubmission, setActiveSubmission] = useState<CodeLabSubmission | null>(null);

  const draftKey = id ? `codelab_${id}_draft` : "";

  useEffect(() => {
    if (!codelabQuery.data || !draftKey) {
      return;
    }
    const draft = window.localStorage.getItem(draftKey);
    setCode(draft ?? codelabQuery.data.starter_code);
  }, [codelabQuery.data?.id, draftKey]);

  useEffect(() => {
    if (!draftKey || !code) {
      return;
    }
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, code);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [code, draftKey]);

  const submissions = useMemo(() => submissionsQuery.data?.data ?? [], [submissionsQuery.data?.data]);
  const canEdit =
    user?.role === "admin" ||
    (user?.role === "teacher" && codelabQuery.data && user.id === codelabQuery.data.teacher_id);
  const isBusy = runMutation.isPending || submitMutation.isPending;

  if (!id) {
    return <p className="text-sm text-destructive">题目不存在。</p>;
  }

  if (codelabQuery.isLoading) {
    return <p className="text-sm text-foreground/70">题目加载中...</p>;
  }

  if (codelabQuery.isError || !codelabQuery.data) {
    return (
      <p className="text-sm text-destructive">
        {codelabQuery.error instanceof Error ? codelabQuery.error.message : "题目加载失败"}
      </p>
    );
  }

  const codelab = codelabQuery.data;
  const publicTestCasesCount = codelab.test_cases.filter((testCase) => !testCase.is_hidden).length;
  const hiddenTestCasesCount = codelab.test_cases.filter((testCase) => testCase.is_hidden).length;

  const handleRun = async () => {
    const result = await runMutation.mutateAsync({ codelabId: codelab.id, code });
    setActiveSubmission(result);
  };

  const handleSubmit = async () => {
    const result = await submitMutation.mutateAsync({ codelabId: codelab.id, code });
    setActiveSubmission(result);
    if (result.status === "success" && result.score === result.max_score) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
    }
  };

  return (
    <section className="space-y-4">
      <nav className="text-sm text-foreground/70">
        <Link to="/codelab" className="hover:text-primary">
          代码实训
        </Link>
        <span className="mx-2">/</span>
        <span>{codelab.title}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{codelab.title}</h1>
          <p className="mt-1 text-sm text-foreground/70">
            {codelab.course_title ?? "未关联课程"} {codelab.chapter_title ? `/ ${codelab.chapter_title}` : ""} / {codelab.language}
            / 难度 {codelab.difficulty} / 最高分 {codelab.best_score ?? 0}/{codelab.max_score}
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => navigate(`/codelab/${codelab.id}/edit`)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
          >
            编辑题目
          </button>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-4 rounded-md border border-border bg-surface p-4">
          <MarkdownRenderer content={codelab.description} />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">测试用例</h2>
              <span className="text-xs text-muted-foreground">
                公开 {publicTestCasesCount} 个{hiddenTestCasesCount > 0 ? ` / 隐藏 ${hiddenTestCasesCount} 个` : ""}
              </span>
            </div>
            {codelab.test_cases.length ? (
              codelab.test_cases.map((testCase) => (
                <div
                  key={testCase.id ?? testCase.name}
                  className={`rounded-md border p-3 ${
                    testCase.is_hidden ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-border"
                  }`}
                >
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{testCase.name}</span>
                    <span className={testCase.is_hidden ? "text-amber-700 dark:text-amber-300" : "text-primary"}>
                      {testCase.is_hidden ? "隐藏用例" : "公开用例"}
                    </span>
                  </div>
                  <div className="grid gap-2 text-xs md:grid-cols-2">
                    <pre className="overflow-auto rounded bg-muted p-2">输入{"\n"}{testCase.input_data ?? ""}</pre>
                    <pre className="overflow-auto rounded bg-muted p-2">输出{"\n"}{testCase.expected_output ?? ""}</pre>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-foreground/70">暂无测试用例。</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <CodeEditor
            code={code}
            language={codelab.language}
            isBusy={isBusy}
            onChange={setCode}
            onReset={() => {
              if (window.confirm("确认重置为初始代码？")) {
                setCode(codelab.starter_code);
                window.localStorage.removeItem(draftKey);
              }
            }}
            onRun={() => void handleRun()}
            onSubmit={() => void handleSubmit()}
          />
          {runMutation.isError || submitMutation.isError ? (
            <p className="text-sm text-destructive">
              {(runMutation.error ?? submitMutation.error) instanceof Error
                ? (runMutation.error ?? submitMutation.error)?.message
                : "执行失败"}
            </p>
          ) : null}
          <ConsolePanel
            activeSubmission={activeSubmission ?? submissions[0] ?? null}
            submissions={submissions}
            loadingHistory={submissionsQuery.isLoading}
          />
        </div>
      </div>
    </section>
  );
}
