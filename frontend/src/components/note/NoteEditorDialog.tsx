import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  Note,
  NoteCreateInput,
  NoteUpdateInput,
  useCreateNote,
  useUpdateNote,
} from "../../lib/api";
import { NoteRelationFields } from "./NoteRelationFields";
import { NoteTagInput } from "./NoteTagInput";

interface NoteEditorDialogProps {
  open: boolean;
  note?: Note | null;
  initialCourseId?: string;
  initialChapterId?: string;
  initialContent?: string;
  initialSourceRef?: string;
  onClose: () => void;
  onSaved?: (note: Note) => void;
}

const snippets = ["$", "$$", "\\frac{}{}", "\\sum_{}^{}"];

export function NoteEditorDialog({
  open,
  note,
  initialCourseId,
  initialChapterId,
  initialContent,
  initialSourceRef,
  onClose,
  onSaved,
}: NoteEditorDialogProps) {
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [courseId, setCourseId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(note?.title ?? "");
    setContent(note?.content ?? initialContent ?? "");
    setTags(note?.tags ?? []);
    setCourseId(note?.course_id ?? initialCourseId ?? "");
    setChapterId(note?.chapter_id ?? initialChapterId ?? "");
    setIsPublic(note?.is_public ?? false);
    setErrorMessage("");
  }, [initialChapterId, initialContent, initialCourseId, note, open]);

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

  const canSave = useMemo(() => Boolean(content.trim()), [content]);
  const isPending = createNoteMutation.isPending || updateNoteMutation.isPending;

  async function saveNote(shouldClose: boolean): Promise<void> {
    if (!canSave) {
      return;
    }
    setErrorMessage("");
    try {
      const createPayload: NoteCreateInput = {
        title: title.trim() || undefined,
        content: content.trim(),
        course_id: courseId || undefined,
        chapter_id: chapterId || undefined,
        tags,
        is_public: isPublic,
        source_paragraph_ref: note?.source_paragraph_ref ?? initialSourceRef,
      };
      const updatePayload: NoteUpdateInput = {
        title: title.trim() || null,
        content: content.trim(),
        course_id: courseId || null,
        chapter_id: chapterId || null,
        tags,
        is_public: isPublic,
        source_paragraph_ref: note?.source_paragraph_ref ?? initialSourceRef ?? null,
      };
      const savedNote = note
        ? await updateNoteMutation.mutateAsync({
            noteId: note.id,
            input: updatePayload,
          })
        : await createNoteMutation.mutateAsync(createPayload);
      onSaved?.(savedNote);
      if (shouldClose) {
        onClose();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存失败，请稍后再试。");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void saveNote(true);
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 md:items-center md:p-4">
      <div className="flex max-h-dvh w-full flex-col border border-border bg-surface text-foreground shadow-xl md:max-h-[92vh] md:max-w-4xl md:rounded-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-5 md:py-4">
          <h2 className="text-lg font-semibold">{note ? "编辑笔记" : "新建笔记"}</h2>
          <button type="button" onClick={onClose} className="rounded border border-border bg-surface px-3 py-2 text-sm hover:bg-muted">
            关闭
          </button>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="标题（可选）"
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />

          <div className="flex flex-wrap gap-2">
            {snippets.map((snippet) => (
              <button
                key={snippet}
                type="button"
                onClick={() => setContent((current) => `${current}${current ? " " : ""}${snippet}`)}
                className="rounded border border-border bg-surface px-2 py-1 text-xs hover:bg-muted"
              >
                {snippet}
              </button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="笔记内容（支持 Markdown / LaTeX）"
            className="min-h-60 w-full rounded-md border border-border bg-surface px-3 py-2"
          />

          <NoteRelationFields
            courseId={courseId}
            chapterId={chapterId}
            onCourseChange={setCourseId}
            onChapterChange={setChapterId}
          />

          <NoteTagInput tags={tags} onChange={setTags} />

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
            公开分享
          </label>

          {errorMessage ? <p className="text-sm text-destructive" role="alert">{errorMessage}</p> : null}

          <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-border bg-surface px-4 py-3 md:-mx-5 md:px-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-surface px-3 py-2 text-sm hover:bg-muted"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSave || isPending}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isPending ? "保存中..." : "发布"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
