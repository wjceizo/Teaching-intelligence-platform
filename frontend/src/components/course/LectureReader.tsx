import { ChapterDetail, ChapterSummary } from "../../lib/api";
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
}: LectureReaderProps) {
  if (!chapter) {
    return <div className="rounded-xl border border-border bg-background p-4">请选择章节开始学习。</div>;
  }

  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null;

  return (
    <div className="relative rounded-xl border border-border bg-background p-6">
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onAskQuestion}
          className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
        >
          提问
        </button>
        <button type="button" className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted">
          添加笔记
        </button>
      </div>

      <h2 className="mb-4 text-2xl font-semibold">{chapter.title}</h2>
      <MarkdownRenderer content={chapter.content} />

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
    </div>
  );
}
