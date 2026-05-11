import { useState, type MouseEvent } from "react";

import { ChapterDetail, ChapterSummary, Note, useChapterPublicNotes, useDeleteNote } from "../../lib/api";
import { ChapterPublicNotes } from "../note/ChapterPublicNotes";
import { NoteDetailDrawer } from "../note/NoteDetailDrawer";
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
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [initialNoteContent, setInitialNoteContent] = useState("");
  const [noteError, setNoteError] = useState("");
  const [selectionButton, setSelectionButton] = useState<{ x: number; y: number; text: string } | null>(null);
  const publicNotesQuery = useChapterPublicNotes(chapter?.id);
  const deleteNoteMutation = useDeleteNote();

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
    setEditingNote(null);
    setInitialNoteContent(content);
    setNoteEditorOpen(true);
    setSelectionButton(null);
  }

  function openEditNote(note: Note): void {
    setEditingNote(note);
    setInitialNoteContent("");
    setNoteEditorOpen(true);
  }

  async function handleDeleteNote(note: Note): Promise<void> {
    if (!window.confirm("确定删除这条笔记吗？")) {
      return;
    }
    setNoteError("");
    try {
      await deleteNoteMutation.mutateAsync(note.id);
      setSelectedNote(null);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "删除失败，请稍后再试。");
    }
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

      {noteError ? <p className="mt-3 text-sm text-red-600">{noteError}</p> : null}
      <ChapterPublicNotes
        notes={publicNotesQuery.data ?? []}
        isLoading={publicNotesQuery.isLoading}
        isError={publicNotesQuery.isError}
        onOpen={setSelectedNote}
      />

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
        note={editingNote}
        initialCourseId={chapter.course_id}
        initialChapterId={chapter.id}
        initialContent={initialNoteContent}
        onClose={() => setNoteEditorOpen(false)}
        onSaved={setSelectedNote}
      />
      <NoteDetailDrawer
        note={selectedNote}
        open={Boolean(selectedNote)}
        onClose={() => setSelectedNote(null)}
        onEdit={openEditNote}
        onDelete={(note) => void handleDeleteNote(note)}
      />
    </div>
  );
}
