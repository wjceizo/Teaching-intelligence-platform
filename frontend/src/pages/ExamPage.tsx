import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import {
  ExamAnswerValue,
  ExamQuestionInPaper,
  useExamAttempt,
  useReportExamViolation,
  useSaveExamDraft,
  useSubmitExamAttempt,
} from "../lib/api";

function formatRemaining(deadlineAt: string | null): string {
  if (!deadlineAt) return "--:--";
  const remaining = Math.max(0, new Date(deadlineAt).getTime() - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isAnswered(value: ExamAnswerValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

interface AnswerControlProps {
  paper: ExamQuestionInPaper;
  value: ExamAnswerValue;
  onChange: (value: ExamAnswerValue) => void;
}

function AnswerControl({ paper, value, onChange }: AnswerControlProps) {
  const question = paper.question;
  if (question.type === "single") {
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((option) => (
          <label key={option.id} className="flex gap-2 rounded-md border border-border p-3 text-sm">
            <input type="radio" checked={value === option.id} onChange={() => onChange(option.id)} />
            <span>{option.label}. {option.content}</span>
          </label>
        ))}
      </div>
    );
  }
  if (question.type === "multi") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        {(question.options ?? []).map((option) => (
          <label key={option.id} className="flex gap-2 rounded-md border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={(event) => {
                onChange(event.target.checked ? [...selected, option.id] : selected.filter((item) => item !== option.id));
              }}
            />
            <span>{option.label}. {option.content}</span>
          </label>
        ))}
      </div>
    );
  }
  return (
    <textarea
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      rows={question.type === "proof" ? 12 : 6}
      className="w-full rounded-md border border-border bg-surface p-3 text-sm"
      placeholder={question.type === "fill" ? "填写答案" : "输入作答内容，支持 LaTeX 文本"}
    />
  );
}

export function ExamPage() {
  const { id, attemptId } = useParams();
  const navigate = useNavigate();
  const attemptQuery = useExamAttempt(attemptId);
  const saveMutation = useSaveExamDraft();
  const submitMutation = useSubmitExamAttempt();
  const violationMutation = useReportExamViolation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, ExamAnswerValue>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!attemptQuery.data) return;
    const localRaw = window.localStorage.getItem(`exam_${attemptQuery.data.attempt_id}_draft`);
    if (localRaw) {
      try {
        setAnswers({ ...attemptQuery.data.saved_answers, ...(JSON.parse(localRaw) as Record<string, ExamAnswerValue>) });
        return;
      } catch {
        setAnswers(attemptQuery.data.saved_answers);
        return;
      }
    }
    setAnswers(attemptQuery.data.saved_answers);
  }, [attemptQuery.data]);

  useEffect(() => {
    if (!attemptId) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(`exam_${attemptId}_draft`, JSON.stringify(answers));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [answers, attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    const timer = window.setInterval(() => {
      saveMutation.mutate({ attemptId, answers });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [answers, attemptId, saveMutation]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!attemptQuery.data?.deadline_at || !attemptId || submitMutation.isPending) return;
    if (new Date(attemptQuery.data.deadline_at).getTime() <= Date.now()) {
      submitMutation.mutate({ attemptId, answers }, { onSuccess: (result) => navigate(`/exam/${id}/result/${result.attempt_id}`) });
    }
  }, [answers, attemptId, attemptQuery.data?.deadline_at, id, navigate, submitMutation, tick]);

  useEffect(() => {
    if (!attemptId) return;
    const report = () => violationMutation.mutate({ attemptId, reason: "visibility_or_focus_changed" });
    const handleVisibility = () => {
      if (document.hidden) report();
    };
    window.addEventListener("blur", report);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("blur", report);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [attemptId, violationMutation]);

  const questions = attemptQuery.data?.questions ?? [];
  const current = questions[currentIndex];
  const unansweredCount = useMemo(
    () => questions.filter((item) => !isAnswered(answers[item.question_id] ?? null)).length,
    [answers, questions]
  );
  const remainingText = formatRemaining(attemptQuery.data?.deadline_at ?? null);
  const remainingMs = attemptQuery.data?.deadline_at ? new Date(attemptQuery.data.deadline_at).getTime() - Date.now() : 0;

  if (attemptQuery.isLoading) return <p className="text-sm text-muted-foreground">答题数据加载中...</p>;
  if (attemptQuery.isError || !attemptQuery.data || !current) {
    return <p className="text-sm text-destructive">{attemptQuery.error instanceof Error ? attemptQuery.error.message : "答题数据加载失败"}</p>;
  }

  const handleSubmit = () => {
    const ok = window.confirm(`还有 ${unansweredCount} 题未作答，${marked.size} 题已标记。确认提交？`);
    if (!ok || !attemptId) return;
    submitMutation.mutate({ attemptId, answers }, { onSuccess: (result) => navigate(`/exam/${id}/result/${result.attempt_id}`) });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-semibold">在线答题</h1>
          <p className="text-xs text-muted-foreground">
            自动保存：{saveMutation.isPending ? "保存中" : saveMutation.isSuccess ? "已保存" : "本地草稿"}
          </p>
        </div>
        <div className={`text-lg font-semibold ${remainingMs < 5 * 60 * 1000 ? "text-destructive" : ""}`}>{remainingText}</div>
        <button type="button" onClick={handleSubmit} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
          提交试卷
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-md border border-border bg-surface p-3">
          <div className="grid grid-cols-5 gap-2">
            {questions.map((item, index) => {
              const answered = isAnswered(answers[item.question_id] ?? null);
              const isMarked = marked.has(item.question_id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-9 rounded border text-sm ${
                    index === currentIndex ? "border-primary" : "border-border"
                  } ${answered ? "bg-primary/15 text-primary" : "bg-muted"} ${isMarked ? "ring-2 ring-amber-400" : ""}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="rounded-md border border-border bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">第 {currentIndex + 1} 题 · {current.question.type} · {current.points} 分</span>
            <button
              type="button"
              onClick={() =>
                setMarked((previous) => {
                  const next = new Set(previous);
                  if (next.has(current.question_id)) next.delete(current.question_id);
                  else next.add(current.question_id);
                  return next;
                })
              }
              className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
            >
              {marked.has(current.question_id) ? "取消标记" : "标记题目"}
            </button>
          </div>
          <MarkdownRenderer content={current.question.content} />
          <div className="mt-4">
            <AnswerControl
              paper={current}
              value={answers[current.question_id] ?? null}
              onChange={(value) => setAnswers((previous) => ({ ...previous, [current.question_id]: value }))}
            />
          </div>
          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
              disabled={currentIndex === 0}
              className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
            >
              上一题
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => attemptId && saveMutation.mutate({ attemptId, answers })}
                className="rounded-md border border-border px-3 py-2 text-sm"
              >
                保存草稿
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))}
                disabled={currentIndex === questions.length - 1}
                className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50"
              >
                下一题
              </button>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
