import { FormEvent, useEffect, useMemo, useState } from "react";

import { useCourse, useCourses, useCreateQuestion } from "../../lib/api";

interface AskQuestionDialogProps {
  open: boolean;
  initialCourseId?: string;
  initialChapterId?: string;
  initialQuotedParagraph?: string;
  onClose: () => void;
  onCreated?: (questionId: string) => void;
}

function buildInitialContent(quotedParagraph?: string): string {
  if (!quotedParagraph?.trim()) {
    return "";
  }
  return `> 引用段落\n> ${quotedParagraph.trim().replace(/\n/g, "\n> ")}\n\n我的问题：\n`;
}

export function AskQuestionDialog({
  open,
  initialCourseId,
  initialChapterId,
  initialQuotedParagraph,
  onClose,
  onCreated,
}: AskQuestionDialogProps) {
  const createQuestionMutation = useCreateQuestion();
  const coursesQuery = useCourses(1, 100);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [courseId, setCourseId] = useState(initialCourseId ?? "");
  const [chapterId, setChapterId] = useState(initialChapterId ?? "");
  const [type, setType] = useState<"ai" | "teacher">("teacher");

  const selectedCourseId = courseId || undefined;
  const courseDetailQuery = useCourse(selectedCourseId);
  const chapters = courseDetailQuery.data?.chapters ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }
    setCourseId(initialCourseId ?? "");
    setChapterId(initialChapterId ?? "");
    setContent(buildInitialContent(initialQuotedParagraph));
  }, [open, initialCourseId, initialChapterId, initialQuotedParagraph]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const canSubmit = useMemo(() => {
    return Boolean(title.trim() && content.trim() && courseId);
  }, [title, content, courseId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    const question = await createQuestionMutation.mutateAsync({
      title: title.trim(),
      content: content.trim(),
      course_id: courseId,
      chapter_id: chapterId || undefined,
      type,
    });

    setTitle("");
    setContent("");
    onClose();
    onCreated?.(question.id);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 md:items-center md:p-4">
      <div className="flex max-h-dvh w-full flex-col border border-border bg-surface text-foreground shadow-xl md:max-h-[92vh] md:max-w-2xl md:rounded-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5">
          <h2 className="text-lg font-semibold">发起提问</h2>
          <button type="button" onClick={onClose} className="rounded border border-border px-3 py-2 text-sm hover:bg-muted">
            关闭
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="问题标题"
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="问题内容（支持 Markdown / LaTeX）"
            className="min-h-36 w-full rounded-md border border-border bg-surface px-3 py-2"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setChapterId("");
              }}
              className="rounded-md border border-border bg-surface px-3 py-2"
            >
              <option value="">选择课程</option>
              {(coursesQuery.data?.data ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            <select
              value={chapterId}
              onChange={(event) => setChapterId(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 disabled:opacity-60"
              disabled={!courseId}
            >
              <option value="">选择章节（可选）</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as "ai" | "teacher")}
              className="rounded-md border border-border bg-surface px-3 py-2"
            >
              <option value="ai">AI 答疑</option>
              <option value="teacher">教师答疑</option>
            </select>
          </div>

          <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-border bg-surface px-4 py-3 md:-mx-5 md:px-5">
            <button type="button" onClick={onClose} className="rounded border border-border px-3 py-2 text-sm hover:bg-muted">
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit || createQuestionMutation.isPending}
              className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createQuestionMutation.isPending ? "提交中..." : "提交问题"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
