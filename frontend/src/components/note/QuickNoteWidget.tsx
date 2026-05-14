import { useEffect, useState } from "react";

import { useCreateNote } from "../../lib/api";

interface QuickNoteWidgetProps {
  open: boolean;
  courseId?: string;
  chapterId?: string;
  onClose: () => void;
}

function buildExcerptContent(text: string): string {
  if (!text.trim()) {
    return "";
  }
  return `> 摘录\n> ${text.trim().replace(/\n/g, "\n> ")}\n\n补充说明：\n`;
}

export function QuickNoteWidget({ open, courseId, chapterId, onClose }: QuickNoteWidgetProps) {
  const createNoteMutation = useCreateNote();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const selectedText = typeof window === "undefined" ? "" : window.getSelection()?.toString() ?? "";
    setTitle("");
    setContent(buildExcerptContent(selectedText));
    setErrorMessage("");
  }, [open]);

  async function handleSave(): Promise<void> {
    if (!content.trim()) {
      return;
    }
    setErrorMessage("");
    try {
      await createNoteMutation.mutateAsync({
        title: title.trim() || undefined,
        content: content.trim(),
        course_id: courseId,
        chapter_id: chapterId,
        tags: ["摘录"],
        is_public: false,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败，请稍后再试。");
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="absolute right-4 top-24 z-20 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">快速笔记</h3>
        <button type="button" onClick={onClose} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">
          关闭
        </button>
      </div>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="标题（可选）"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="选中文字后添加笔记，也可以直接输入。"
          className="min-h-40 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
        />
        {errorMessage ? <p className="text-xs text-destructive" role="alert">{errorMessage}</p> : null}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!content.trim() || createNoteMutation.isPending}
          className="w-full rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {createNoteMutation.isPending ? "保存中..." : "保存笔记"}
        </button>
      </div>
    </div>
  );
}
