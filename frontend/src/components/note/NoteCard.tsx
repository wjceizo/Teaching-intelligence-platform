import { Note } from "../../lib/api";

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

const tagStyles = [
  "bg-info-surface text-info",
  "bg-success-surface text-success",
  "bg-warning-surface text-warning",
  "bg-destructive-surface text-destructive",
  "bg-muted text-muted-foreground",
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NoteCard({ note, onOpen, onEdit, onDelete }: NoteCardProps) {
  const source = [note.course_title, note.chapter_title].filter(Boolean).join(" / ");

  return (
    <article className="group break-inside-avoid rounded-lg border border-border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md">
      <button type="button" onClick={() => onOpen(note)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{note.title || "未命名笔记"}</h2>
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {note.is_public ? "公开" : "私有"}
          </span>
        </div>

        <p className="mt-3 max-h-20 overflow-hidden whitespace-pre-wrap text-sm leading-6 text-foreground/75">
          {note.content}
        </p>

        {note.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((tag, index) => (
              <span
                key={tag}
                className={`rounded-full px-2 py-0.5 text-xs ${tagStyles[index % tagStyles.length]}`}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <p className="mt-3 text-xs text-muted-foreground">
          作者：{note.user.username}
          {source ? ` / ${source}` : ""}
        </p>
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{formatDate(note.updated_at)}</span>
        <div className="flex gap-2 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="rounded border border-border bg-surface px-2 py-1 text-xs hover:bg-muted"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="rounded border border-destructive/45 bg-destructive-surface px-2 py-1 text-xs text-destructive hover:bg-destructive-surface/80"
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}
