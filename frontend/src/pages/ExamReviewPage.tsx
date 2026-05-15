import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import { useExam, useExamResult, useGradeExamAttempt, usePendingReviews } from "../lib/api";

export function ExamReviewPage() {
  const { id } = useParams();
  const reviewsQuery = usePendingReviews(id, 1, 50);
  const examQuery = useExam(id);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | undefined>();
  const resultQuery = useExamResult(selectedAttemptId);
  const gradeMutation = useGradeExamAttempt();
  const [scores, setScores] = useState<Record<string, { score: number; teacher_comment: string }>>({});

  const selectedAttempt = selectedAttemptId ?? reviewsQuery.data?.data[0]?.id;
  const result = selectedAttemptId ? resultQuery.data : undefined;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">主观题批阅</h1>
          <p className="text-sm text-muted-foreground">{examQuery.data?.title ?? "选择提交后开始批阅。"}</p>
        </div>
        {id ? <Link to={`/exam/${id}/stats`} className="rounded-md border border-border px-3 py-2 text-sm">统计</Link> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2 rounded-md border border-border bg-surface p-3">
          {reviewsQuery.data?.data.map((attempt) => (
            <button
              key={attempt.id}
              type="button"
              onClick={() => {
                setSelectedAttemptId(attempt.id);
                setScores({});
              }}
              className={`block w-full rounded-md border p-3 text-left text-sm ${selectedAttempt === attempt.id ? "border-primary" : "border-border"}`}
            >
              <span className="font-medium">{attempt.student_name ?? attempt.user_id}</span>
              <span className="mt-1 block text-xs text-muted-foreground">客观题 {attempt.auto_score} / {attempt.total_score}</span>
            </button>
          ))}
          {reviewsQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">暂无待批阅提交。</p> : null}
        </aside>

        <main className="space-y-3 rounded-md border border-border bg-surface p-4">
          {!selectedAttemptId && reviewsQuery.data?.data[0] ? (
            <button type="button" onClick={() => setSelectedAttemptId(reviewsQuery.data.data[0].id)} className="rounded-md border border-border px-3 py-2 text-sm">加载第一份提交</button>
          ) : null}
          {result?.answers.filter((answer) => answer.pending_review).map((answer, index) => {
            const paper = examQuery.data?.questions.find((item) => item.question_id === answer.question_id);
            const draft = scores[answer.question_id] ?? { score: 0, teacher_comment: "" };
            return (
              <div key={answer.question_id} className="rounded-md border border-border p-4">
                <div className="mb-3 text-sm font-medium">主观题 {index + 1} · 满分 {answer.max_score}</div>
                {paper ? <MarkdownRenderer content={paper.question.content} /> : null}
                <div className="mt-3 rounded bg-muted p-3 text-sm">学生答案：{typeof answer.user_answer === "string" ? answer.user_answer : "未作答"}</div>
                <div className="mt-3 rounded bg-muted p-3 text-sm">参考答案：{typeof answer.standard_answer === "string" ? answer.standard_answer : "暂无"}</div>
                <div className="mt-3 grid gap-2 md:grid-cols-[120px_1fr]">
                  <input
                    type="number"
                    min={0}
                    max={answer.max_score}
                    value={draft.score}
                    onChange={(event) => setScores((current) => ({ ...current, [answer.question_id]: { ...draft, score: Number(event.target.value) } }))}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <input
                    value={draft.teacher_comment}
                    onChange={(event) => setScores((current) => ({ ...current, [answer.question_id]: { ...draft, teacher_comment: event.target.value } }))}
                    placeholder="教师评语"
                    className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  />
                </div>
              </div>
            );
          })}
          {result && result.answers.filter((answer) => answer.pending_review).length === 0 ? <p className="text-sm text-muted-foreground">这份提交没有待批阅题目。</p> : null}
          {selectedAttemptId ? (
            <button
              type="button"
              onClick={() =>
                gradeMutation.mutate({
                  attemptId: selectedAttemptId,
                  answers: Object.entries(scores).map(([question_id, value]) => ({
                    question_id,
                    score: value.score,
                    teacher_comment: value.teacher_comment || null,
                  })),
                })
              }
              disabled={Object.keys(scores).length === 0}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              保存批阅
            </button>
          ) : null}
        </main>
      </div>
    </section>
  );
}
