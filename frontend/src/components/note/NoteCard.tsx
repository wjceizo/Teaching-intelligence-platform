import { Note } from "../../lib/api";

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

const tagStyles = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
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
    <article className="group break-inside-avoid rounded-lg border border-border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <button type="button" onClick={() => onOpen(note)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{note.title || "未命名笔记"}</h2>
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-foreground/70">
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

        <p className="mt-3 text-xs text-foreground/60">
          作者：{note.user.username}
          {source ? ` · ${source}` : ""}
        </p>
      </button>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-foreground/55">{formatDate(note.updated_at)}</span>
        <div className="flex gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            删除
          </button>
        </div>
      </div>
    </article>
  );
}
