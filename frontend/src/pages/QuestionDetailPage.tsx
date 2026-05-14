import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { AnswerItem } from "../components/qa/AnswerItem";
import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import {
  useCourse,
  useCreateAnswer,
  useDeleteAnswer,
  useDeleteQuestion,
  useQuestion,
  useResolveQuestion,
  useUpdateAnswer,
  useUpdateQuestion,
  useVoteAnswer,
} from "../lib/api";
import { useAuthStore } from "../stores/authStore";

function createQuestionSocketUrl(questionId: string, token: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/v1/questions/${questionId}/ws?token=${encodeURIComponent(token)}`;
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

export function QuestionDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const questionQuery = useQuestion(id);
  const createAnswerMutation = useCreateAnswer();
  const voteMutation = useVoteAnswer();
  const resolveMutation = useResolveQuestion();
  const updateQuestionMutation = useUpdateQuestion();
  const deleteQuestionMutation = useDeleteQuestion();
  const updateAnswerMutation = useUpdateAnswer();
  const deleteAnswerMutation = useDeleteAnswer();

  const [answerContent, setAnswerContent] = useState("");
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [questionTitleDraft, setQuestionTitleDraft] = useState("");
  const [questionContentDraft, setQuestionContentDraft] = useState("");

  const courseId = questionQuery.data?.course_id;
  const courseQuery = useCourse(courseId);
  const chapterTitle = useMemo(() => {
    if (!courseQuery.data || !questionQuery.data?.chapter_id) {
      return "全课程";
    }
    return (
      courseQuery.data.chapters.find((chapter) => chapter.id === questionQuery.data?.chapter_id)?.title ?? "未找到章节"
    );
  }, [courseQuery.data, questionQuery.data?.chapter_id]);

  useEffect(() => {
    if (!id || !token) {
      return;
    }

    const websocket = new WebSocket(createQuestionSocketUrl(id, token));
    websocket.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["question", id] });
      void queryClient.invalidateQueries({ queryKey: ["questions"] });
    };
    websocket.onerror = () => {
      console.error("question websocket error");
    };

    return () => {
      websocket.close();
    };
  }, [id, token, queryClient]);

  useEffect(() => {
    if (!questionQuery.data) {
      return;
    }
    setQuestionTitleDraft(questionQuery.data.title);
    setQuestionContentDraft(questionQuery.data.content);
  }, [questionQuery.data]);

  const handleSubmitAnswer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!id || !answerContent.trim()) {
      return;
    }
    await createAnswerMutation.mutateAsync({
      questionId: id,
      input: { content: answerContent.trim() },
    });
    setAnswerContent("");
  };

  if (!id) {
    return <p>问题不存在。</p>;
  }

  if (questionQuery.isLoading) {
    return <p className="text-sm text-foreground/70">问题加载中...</p>;
  }

  if (questionQuery.isError || !questionQuery.data) {
    return (
      <p className="text-sm text-red-600">
        问题加载失败：{questionQuery.error instanceof Error ? questionQuery.error.message : "未知错误"}
      </p>
    );
  }

  const question = questionQuery.data;

  const canResolve = user?.id === question.user_id || user?.role === "teacher" || user?.role === "admin";
  const canManageQuestion = user?.id === question.user_id || user?.role === "admin";
  const courseColorClass = pickCourseColor(question.course_id);

  return (
    <section className="space-y-4">
      <nav className="text-sm text-foreground/70">
        <Link to="/qa" className="hover:text-primary">
          问答中心
        </Link>
        <span className="mx-2">/</span>
        <span>问题详情</span>
      </nav>

      <article className="space-y-3 rounded-xl border border-border bg-background p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs ${question.type === "ai" ? "bg-cyan-100 text-cyan-700" : "bg-emerald-100 text-emerald-700"}`}>
            {question.type === "ai" ? "AI答疑" : "教师答疑"}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs ${question.status === "resolved" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700"}`}>
            {question.status === "resolved" ? "已解决" : "未解决"}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs ${courseColorClass}`}>{courseQuery.data?.title ?? "课程"}</span>
          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-700">{chapterTitle}</span>
          {question.is_pinned ? <span className="text-sm text-amber-600">📌 置顶</span> : null}
        </div>

        {editingQuestion ? (
          <div className="space-y-2">
            <input
              value={questionTitleDraft}
              onChange={(event) => setQuestionTitleDraft(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold"
            />
            <textarea
              value={questionContentDraft}
              onChange={(event) => setQuestionContentDraft(event.target.value)}
              className="min-h-40 w-full rounded-md border border-border bg-background px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={updateQuestionMutation.isPending || !questionTitleDraft.trim() || !questionContentDraft.trim()}
                onClick={() => {
                  updateQuestionMutation.mutate({
                    questionId: question.id,
                    input: {
                      title: questionTitleDraft.trim(),
                      content: questionContentDraft.trim(),
                    },
                  });
                  setEditingQuestion(false);
                }}
                className="rounded border border-border bg-surface px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
              >
                保存问题
              </button>
              <button type="button" onClick={() => setEditingQuestion(false)} className="rounded border border-border px-3 py-1 text-sm">
                取消
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">{question.title}</h1>
            <MarkdownRenderer content={question.content} />
          </>
        )}

        {question.paragraph_excerpt ? (
          <blockquote className="rounded border-l-4 border-primary/40 bg-muted/50 p-3 text-sm text-foreground/80">
            引用段落：{question.paragraph_excerpt}
          </blockquote>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/70">
          <span>提问人：{question.user.username}</span>
          <span>浏览：{question.view_count}</span>
          <span>回答：{question.answers_count}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canResolve && question.status !== "resolved" ? (
            <button
              type="button"
              onClick={() => resolveMutation.mutate(question.id)}
              disabled={resolveMutation.isPending}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {resolveMutation.isPending ? "处理中..." : "标记为已解决"}
            </button>
          ) : null}
          {canManageQuestion ? (
            <>
              <button type="button" onClick={() => setEditingQuestion((previous) => !previous)} className="rounded border border-border px-3 py-2 text-sm">
                {editingQuestion ? "收起编辑" : "编辑问题"}
              </button>
              <button
                type="button"
                disabled={deleteQuestionMutation.isPending}
                onClick={() => {
                  const confirmed = window.confirm("确认删除该问题？删除后不可恢复。");
                  if (!confirmed) {
                    return;
                  }
                  deleteQuestionMutation.mutate(question.id, {
                    onSuccess: () => {
                      navigate("/qa");
                    },
                  });
                }}
                className="rounded border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
              >
                删除问题
              </button>
            </>
          ) : null}
        </div>
      </article>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">回答</h2>
        {question.answers.map((answer) => {
          const canManageAnswer = user?.id === answer.user?.id || user?.role === "admin";
          return (
            <AnswerItem
              key={answer.id}
              answer={answer}
              votePending={voteMutation.isPending}
              canManage={Boolean(canManageAnswer)}
              editPending={updateAnswerMutation.isPending}
              deletePending={deleteAnswerMutation.isPending}
              onVote={(answerId, vote) => voteMutation.mutate({ answerId, vote })}
              onUpdate={(answerId, content) => updateAnswerMutation.mutate({ answerId, content })}
              onDelete={(answerId) => {
                const confirmed = window.confirm("确认删除该回答？");
                if (!confirmed) {
                  return;
                }
                deleteAnswerMutation.mutate(answerId);
              }}
            />
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-background p-4">
        <h3 className="mb-2 text-base font-semibold">添加回答</h3>
        <form onSubmit={(event) => void handleSubmitAnswer(event)} className="space-y-2">
          <textarea
            value={answerContent}
            onChange={(event) => setAnswerContent(event.target.value)}
            placeholder="请输入你的回答（支持 Markdown / LaTeX）"
            className="min-h-28 w-full rounded-md border border-border bg-background px-3 py-2"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createAnswerMutation.isPending || !answerContent.trim()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createAnswerMutation.isPending ? "提交中..." : "提交回答"}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
