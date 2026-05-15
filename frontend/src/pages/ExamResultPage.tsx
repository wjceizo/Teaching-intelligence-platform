import { Link, useParams } from "react-router-dom";

import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import { ExamAnswerValue, useExam, useExamResult } from "../lib/api";

function answerText(value: ExamAnswerValue): string {
  if (Array.isArray(value)) return value.join("、");
  if (value && typeof value === "object") return JSON.stringify(value);
  return value ?? "未作答";
}

export function ExamResultPage() {
  const { attemptId } = useParams();
  const resultQuery = useExamResult(attemptId);
  const examQuery = useExam(resultQuery.data?.exam_id);

  if (resultQuery.isLoading) return <p className="text-sm text-muted-foreground">结果加载中...</p>;
  if (resultQuery.isError || !resultQuery.data) {
    return <p className="text-sm text-destructive">{resultQuery.error instanceof Error ? resultQuery.error.message : "结果加载失败"}</p>;
  }

  const result = resultQuery.data;
  const exam = examQuery.data;
  const percent = Math.round(((result.score ?? result.auto_score) / result.total_score) * 100);

  return (
    <section className="space-y-4">
      <nav className="text-sm text-muted-foreground">
        <Link to="/exam" className="hover:text-primary">在线测验</Link>
        <span className="mx-2">/</span>
        <span>测验结果</span>
      </nav>

      <div className="rounded-md border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{exam?.title ?? "测验结果"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              状态：{result.status === "pending_review" ? "待批阅" : result.status === "graded" ? "已批阅" : result.status}
            </p>
          </div>
          <div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-primary/30 text-center">
            <div>
              <div className="text-2xl font-semibold">{result.score ?? result.auto_score}</div>
              <div className="text-xs text-muted-foreground">/ {result.total_score}</div>
            </div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded bg-muted">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        {!result.can_view_detail ? <p className="mt-3 text-sm text-muted-foreground">答案和解析暂未公布。</p> : null}
      </div>

      <div className="space-y-3">
        {result.answers.map((answer, index) => {
          const paper = exam?.questions.find((item) => item.question_id === answer.question_id);
          return (
            <details key={answer.question_id} className="rounded-md border border-border bg-surface p-4" open={index === 0}>
              <summary className="cursor-pointer text-sm font-medium">
                第 {index + 1} 题 · {answer.pending_review ? "待批阅" : answer.is_correct ? "正确" : answer.is_correct === false ? "错误" : "已提交"} ·
                得分 {answer.score ?? "--"} / {answer.max_score}
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                {paper ? <MarkdownRenderer content={paper.question.content} /> : null}
                <div className="rounded bg-muted p-3">
                  <span className="font-medium">我的答案：</span>{answerText(answer.user_answer)}
                </div>
                {result.can_view_detail ? (
                  <>
                    <div className="rounded bg-muted p-3">
                      <span className="font-medium">标准答案：</span>{answerText(answer.standard_answer)}
                    </div>
                    {answer.explanation ? <div className="rounded bg-muted p-3">解析：{answer.explanation}</div> : null}
                    {answer.teacher_comment ? <div className="rounded bg-muted p-3">教师评语：{answer.teacher_comment}</div> : null}
                  </>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
