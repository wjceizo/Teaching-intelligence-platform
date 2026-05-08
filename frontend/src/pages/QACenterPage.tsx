import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AskQuestionDialog } from "../components/qa/AskQuestionDialog";
import { QuestionCard } from "../components/qa/QuestionCard";
import { QuestionFilters, useCourses, useQuestions } from "../lib/api";

export function QACenterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as
    | { courseId?: string; chapterId?: string; quotedParagraph?: string; openAsk?: boolean }
    | undefined;
  const [page, setPage] = useState(1);
  const [showAskDialog, setShowAskDialog] = useState(false);
  const [tab, setTab] = useState<"all" | "ai" | "teacher">("all");
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState<"all" | "open" | "resolved">("open");
  const [sort, setSort] = useState<"latest" | "hot" | "unanswered">("latest");
  const pageSize = 20;

  const coursesQuery = useCourses(1, 100);

  const filters = useMemo<QuestionFilters>(() => {
    return {
      course_id: courseId || undefined,
      type: tab === "all" ? undefined : tab,
      status: status === "all" ? undefined : status,
      sort,
    };
  }, [courseId, sort, status, tab]);

  const questionsQuery = useQuestions(filters, page, pageSize);

  useEffect(() => {
    if (locationState?.openAsk) {
      setShowAskDialog(true);
    }
  }, [locationState?.openAsk]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">问答中心</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3 rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-semibold">筛选条件</p>

          <select
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">全部课程</option>
            {(coursesQuery.data?.data ?? []).map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "all" | "open" | "resolved");
              setPage(1);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">全部状态</option>
            <option value="open">未解决</option>
            <option value="resolved">已解决</option>
          </select>

          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "latest" | "hot" | "unanswered");
              setPage(1);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="latest">最新</option>
            <option value="hot">最热</option>
            <option value="unanswered">无人回答</option>
          </select>
        </aside>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTab("all");
                setPage(1);
              }}
              className={`rounded-md border px-3 py-1 text-sm ${
                tab === "all" ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("ai");
                setPage(1);
              }}
              className={`rounded-md border px-3 py-1 text-sm ${
                tab === "ai" ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              AI答疑
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("teacher");
                setPage(1);
              }}
              className={`rounded-md border px-3 py-1 text-sm ${
                tab === "teacher" ? "border-primary bg-primary/10 text-primary" : "border-border"
              }`}
            >
              教师答疑
            </button>
          </div>

          {questionsQuery.isLoading ? <p className="text-sm text-foreground/70">问题加载中...</p> : null}
          {questionsQuery.isError ? (
            <p className="text-sm text-red-600">问题加载失败：{questionsQuery.error.message}</p>
          ) : null}

          <div className="space-y-3">
            {(questionsQuery.data?.data ?? []).map((question) => (
              <QuestionCard key={question.id} question={question} onClick={(id) => navigate(`/qa/${id}`)} />
            ))}
          </div>

          {questionsQuery.data ? (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                className="rounded border border-border px-3 py-1 text-sm disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-sm text-foreground/70">第 {page} 页</span>
              <button
                type="button"
                disabled={page * pageSize >= questionsQuery.data.meta.total}
                onClick={() => setPage((previous) => previous + 1)}
                className="rounded border border-border px-3 py-1 text-sm disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAskDialog(true)}
        className="fixed bottom-8 right-8 z-30 rounded-full border border-black bg-background px-5 py-3 text-sm font-semibold shadow-lg"
      >
        提问
      </button>

      <AskQuestionDialog
        open={showAskDialog}
        initialCourseId={locationState?.courseId}
        initialChapterId={locationState?.chapterId}
        initialQuotedParagraph={locationState?.quotedParagraph}
        onClose={() => setShowAskDialog(false)}
        onCreated={(questionId) => navigate(`/qa/${questionId}`)}
      />
    </section>
  );
}
