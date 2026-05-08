import { FormEvent, useEffect, useMemo, useState } from "react";

import { useCourse, useCourses, useCreateQuestion } from "../../lib/api";

interface AskQuestionDialogProps {
  open: boolean;
  initialCourseId?: string;
  initialChapterId?: string;
  initialParagraphRef?: string;
  onClose: () => void;
  onCreated?: (questionId: string) => void;
}

export function AskQuestionDialog({
  open,
  initialCourseId,
  initialChapterId,
  initialParagraphRef,
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
  const [paragraphRef, setParagraphRef] = useState(initialParagraphRef ?? "");

  const selectedCourseId = courseId || undefined;
  const courseDetailQuery = useCourse(selectedCourseId);
  const chapters = courseDetailQuery.data?.chapters ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }
    setCourseId(initialCourseId ?? "");
    setChapterId(initialChapterId ?? "");
    setParagraphRef(initialParagraphRef ?? "");
  }, [open, initialCourseId, initialChapterId, initialParagraphRef]);

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
      paragraph_ref: paragraphRef || undefined,
    });

    setTitle("");
    setContent("");
    setParagraphRef("");
    onClose();
    onCreated?.(question.id);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">发起提问</h2>
          <button type="button" onClick={onClose} className="rounded border border-border px-2 py-1 text-sm">
            关闭
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="问题标题"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="问题内容（支持 Markdown / LaTeX）"
            className="min-h-36 w-full rounded-md border border-border bg-background px-3 py-2"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setChapterId("");
              }}
              className="rounded-md border border-border bg-background px-3 py-2"
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
              className="rounded-md border border-border bg-background px-3 py-2"
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
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="ai">AI答疑</option>
              <option value="teacher">教师答疑</option>
            </select>
            <input
              value={paragraphRef}
              onChange={(event) => setParagraphRef(event.target.value)}
              placeholder="段落引用（可选）"
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border border-border px-3 py-2 text-sm">
              取消
            </button>
            <button
              type="submit"
              disabled={!canSubmit || createQuestionMutation.isPending}
              className="rounded border border-black bg-transparent px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {createQuestionMutation.isPending ? "提交中..." : "提交问题"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
