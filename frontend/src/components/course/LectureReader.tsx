import { useState, type MouseEvent } from "react";

import { ChapterDetail, ChapterSummary, useChapterPublicNotes } from "../../lib/api";
import { NoteEditorDialog } from "../note/NoteEditorDialog";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface LectureReaderProps {
  chapter: ChapterDetail | undefined;
  currentIndex: number;
  chapters: ChapterSummary[];
  markCompletedPending: boolean;
  canMarkCompleted: boolean;
  onMarkCompleted: () => void;
  onNavigateChapter: (chapterId: string) => void;
  onAskQuestion?: () => void;
  onAskParagraph?: (paragraphText: string) => void;
}

export function LectureReader({
  chapter,
  currentIndex,
  chapters,
  markCompletedPending,
  canMarkCompleted,
  onMarkCompleted,
  onNavigateChapter,
  onAskQuestion,
  onAskParagraph,
}: LectureReaderProps) {
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [initialNoteContent, setInitialNoteContent] = useState("");
  const [selectionButton, setSelectionButton] = useState<{ x: number; y: number; text: string } | null>(null);
  const publicNotesQuery = useChapterPublicNotes(chapter?.id);

  if (!chapter) {
    return <div className="rounded-xl border border-border bg-background p-4">请选择章节开始学习。</div>;
  }

  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  function handleContentMouseUp(event: MouseEvent<HTMLDivElement>): void {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!selection || !text || selection.rangeCount === 0) {
      setSelectionButton(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const selectedNode = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
    if (!selectedNode || !event.currentTarget.contains(selectedNode)) {
      setSelectionButton(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    setSelectionButton({
      x: Math.min(rect.left + rect.width / 2, window.innerWidth - 96),
      y: Math.max(rect.top - 42, 12),
      text,
    });
  }

  function openNoteEditor(content: string): void {
    setInitialNoteContent(content);
    setNoteEditorOpen(true);
    setSelectionButton(null);
  }

  return (
    <div className="relative rounded-xl border border-border bg-background p-6" onMouseUp={handleContentMouseUp}>
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onAskQuestion}
          className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
        >
          提问
        </button>
        <button
          type="button"
          onClick={() => openNoteEditor("")}
          className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
        >
          添加笔记
        </button>
      </div>
      {selectionButton ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => openNoteEditor(`*${selectionButton.text.replace(/\*/g, "\\*")}*\n\n`)}
          className="fixed z-30 rounded-md border border-border bg-background px-3 py-1.5 text-xs shadow-lg hover:bg-muted"
          style={{ left: selectionButton.x, top: selectionButton.y }}
        >
          添加笔记
        </button>
      ) : null}

      <h2 className="mb-4 text-2xl font-semibold">{chapter.title}</h2>
      <MarkdownRenderer content={chapter.content} enableParagraphAsk onAskParagraph={onAskParagraph} />

      <section className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold">相关公开笔记</h3>
        {publicNotesQuery.isLoading ? <p className="mt-2 text-xs text-foreground/60">公开笔记加载中...</p> : null}
        {publicNotesQuery.isError ? <p className="mt-2 text-xs text-red-600">公开笔记加载失败。</p> : null}
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {(publicNotesQuery.data ?? []).slice(0, 4).map((note) => (
            <article key={note.id} className="rounded-md border border-border bg-background p-3">
              <p className="text-sm font-medium">{note.title || "未命名笔记"}</p>
              <p className="mt-1 max-h-12 overflow-hidden whitespace-pre-wrap text-xs leading-5 text-foreground/65">
                {note.content}
              </p>
            </article>
          ))}
        </div>
        {!publicNotesQuery.isLoading && !(publicNotesQuery.data ?? []).length ? (
          <p className="mt-2 text-xs text-foreground/60">本章还没有公开笔记。</p>
        ) : null}
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevChapter}
            onClick={() => prevChapter && onNavigateChapter(prevChapter.id)}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
          >
            上一章
          </button>
          <button
            type="button"
            disabled={!nextChapter}
            onClick={() => nextChapter && onNavigateChapter(nextChapter.id)}
            className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
          >
            下一章
          </button>
        </div>
        {canMarkCompleted ? (
          <button
            type="button"
            onClick={onMarkCompleted}
            disabled={markCompletedPending}
            className="rounded-md border border-black bg-transparent px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {markCompletedPending ? "提交中..." : "完成本章"}
          </button>
        ) : null}
      </div>
      <NoteEditorDialog
        open={noteEditorOpen}
        initialCourseId={chapter.course_id}
        initialChapterId={chapter.id}
        initialContent={initialNoteContent}
        onClose={() => setNoteEditorOpen(false)}
      />
    </div>
  );
}
