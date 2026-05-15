import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { LectureReader } from "../components/course/LectureReader";
import { useChapterContent, useCodeLabs, useCourse, useExams, useUpdateProgress } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function CourseDetailPage() {
  const navigate = useNavigate();
  const { id, chapterId } = useParams();
  const user = useAuthStore((state) => state.user);
  const courseQuery = useCourse(id);

  const chapters = courseQuery.data?.chapters ?? [];
  const fallbackChapterId = chapters[0]?.id;
  const currentChapterId = chapterId ?? fallbackChapterId;
  const currentIndex = Math.max(
    0,
    chapters.findIndex((chapter) => chapter.id === currentChapterId)
  );
  const normalizedCurrentChapterId = chapters[currentIndex]?.id;

  const chapterQuery = useChapterContent(normalizedCurrentChapterId);
  const chapterCodeLabsQuery = useCodeLabs(
    {
      course_id: id,
      chapter_id: normalizedCurrentChapterId,
    },
    1,
    6
  );
  const chapterExamsQuery = useExams(
    {
      course_id: id,
      chapter_id: normalizedCurrentChapterId,
    },
    1,
    6
  );
  const updateProgressMutation = useUpdateProgress();

  const completedSet = useMemo(
    () => new Set(courseQuery.data?.completed_chapter_ids ?? []),
    [courseQuery.data?.completed_chapter_ids]
  );

  if (!id) {
    return <p>课程不存在。</p>;
  }

  if (courseQuery.isLoading) {
    return <p className="text-sm text-foreground/70">课程加载中...</p>;
  }

  if (courseQuery.isError || !courseQuery.data) {
    return (
      <p className="text-sm text-red-600">
        课程加载失败：{courseQuery.error instanceof Error ? courseQuery.error.message : "未知错误"}
      </p>
    );
  }

  const canEdit = user?.role === "admin" || (user?.role === "teacher" && user.id === courseQuery.data.teacher_id);
  const canMarkCompleted = user?.role === "student" && courseQuery.data.is_enrolled;

  return (
    <section className="space-y-4">
      <nav className="text-sm text-foreground/70">
        <Link to="/courses" className="hover:text-primary">
          课程中心
        </Link>
        <span className="mx-2">/</span>
        <span>{courseQuery.data.title}</span>
      </nav>

      <div className="flex items-center gap-2">
        {canEdit ? (
          <button
            type="button"
            onClick={() => navigate(`/courses/${id}/edit`)}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            进入课程编辑器
          </button>
        ) : null}
        {user?.role === "student" && !courseQuery.data.is_enrolled ? (
          <span className="text-sm text-amber-700">加入课程后可记录“完成本章”进度。</span>
        ) : null}
      </div>

      <div className="flex gap-4">
        <aside className="w-64 shrink-0 rounded-xl border border-border bg-background p-3">
          <h3 className="mb-3 text-sm font-semibold">章节目录</h3>
          <div className="space-y-1">
            {chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => navigate(`/courses/${id}/chapters/${chapter.id}`)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${
                  chapter.id === normalizedCurrentChapterId ? "bg-primary/15 text-primary" : "hover:bg-muted"
                }`}
              >
                <span>
                  {index + 1}. {chapter.title}
                </span>
                {completedSet.has(chapter.id) ? <span className="text-emerald-600">✓</span> : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {chapterQuery.isLoading ? <p className="text-sm text-foreground/70">章节内容加载中...</p> : null}
          {chapterQuery.isError ? (
            <p className="text-sm text-red-600">
              章节内容加载失败：{chapterQuery.error instanceof Error ? chapterQuery.error.message : "未知错误"}
            </p>
          ) : null}

          <LectureReader
            chapter={chapterQuery.data}
            currentIndex={currentIndex}
            chapters={chapters}
            markCompletedPending={updateProgressMutation.isPending}
            canMarkCompleted={canMarkCompleted}
            onNavigateChapter={(nextChapterId) => navigate(`/courses/${id}/chapters/${nextChapterId}`)}
            onMarkCompleted={() => {
              if (!normalizedCurrentChapterId) {
                return;
              }
              updateProgressMutation.mutate({ chapterId: normalizedCurrentChapterId, completed: true });
            }}
            onAskQuestion={() =>
              navigate("/qa", {
                state: {
                  courseId: id,
                  chapterId: normalizedCurrentChapterId,
                  openAsk: true,
                },
              })
            }
            onAskParagraph={(paragraphText) =>
              navigate("/qa", {
                state: {
                  courseId: id,
                  chapterId: normalizedCurrentChapterId,
                  quotedParagraph: paragraphText,
                  openAsk: true,
                },
              })
            }
          />

          {normalizedCurrentChapterId ? (
            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">本章实训</h2>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/codelab/new?course_id=${id}&chapter_id=${normalizedCurrentChapterId}`)}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    新建实训
                  </button>
                ) : null}
              </div>
              {chapterCodeLabsQuery.isLoading ? <p className="text-sm text-foreground/70">实训题加载中...</p> : null}
              {chapterCodeLabsQuery.data?.data.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {chapterCodeLabsQuery.data.data.map((item) => (
                    <Link
                      key={item.id}
                      to={`/codelab/${item.id}`}
                      className="rounded-md border border-border p-3 text-sm hover:border-primary"
                    >
                      <span className="font-medium">{item.title}</span>
                      <span className="mt-1 block text-xs text-foreground/60">
                        {item.language} · 难度 {item.difficulty} · 满分 {item.max_score}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {chapterCodeLabsQuery.data?.data.length === 0 ? (
                <p className="text-sm text-foreground/70">本章暂无实训题。</p>
              ) : null}
            </div>
          ) : null}

          {normalizedCurrentChapterId ? (
            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">本章测验</h2>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/exam/new?course_id=${id}&chapter_id=${normalizedCurrentChapterId}`)}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted"
                  >
                    新建测验
                  </button>
                ) : null}
              </div>
              {chapterExamsQuery.isLoading ? <p className="text-sm text-foreground/70">测验加载中...</p> : null}
              {chapterExamsQuery.data?.data.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {chapterExamsQuery.data.data.map((item) => (
                    <Link
                      key={item.id}
                      to={`/exam/${item.id}`}
                      className="rounded-md border border-border p-3 text-sm hover:border-primary"
                    >
                      <span className="font-medium">
                        {item.title}
                        {item.status === "draft" ? <span className="ml-2 text-xs text-destructive">草稿</span> : null}
                      </span>
                      <span className="mt-1 block text-xs text-foreground/60">
                        {item.question_count} 题 · 满分 {item.total_score} · 限时 {item.time_limit_minutes} 分钟
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {chapterExamsQuery.data?.data.length === 0 ? (
                <p className="text-sm text-foreground/70">本章暂无测验。</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
