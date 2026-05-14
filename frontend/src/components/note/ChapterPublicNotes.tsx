import { Note } from "../../lib/api";

interface ChapterPublicNotesProps {
  notes: Note[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (note: Note) => void;
}

export function ChapterPublicNotes({ notes, isLoading, isError, onOpen }: ChapterPublicNotesProps) {
  return (
    <section className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold">相关公开笔记</h3>
      {isLoading ? <p className="mt-2 text-xs text-muted-foreground">公开笔记加载中...</p> : null}
      {isError ? <p className="mt-2 text-xs text-destructive">公开笔记加载失败。</p> : null}

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {notes.slice(0, 6).map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onOpen(note)}
            className="cursor-pointer rounded-md border border-border bg-surface p-2.5 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-1 text-sm font-medium">{note.title || "未命名笔记"}</p>
              <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                公开
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">作者：{note.user.username}</p>
            <p className="mt-1.5 max-h-10 overflow-hidden whitespace-pre-wrap text-xs leading-5 text-foreground/70">
              {note.content}
            </p>
            {note.tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {note.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-info-surface px-1.5 py-0.5 text-[11px] text-info">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {!isLoading && !notes.length ? <p className="mt-2 text-xs text-muted-foreground">本章还没有公开笔记。</p> : null}
    </section>
  );
}
