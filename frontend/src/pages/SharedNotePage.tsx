import { Link, useParams } from "react-router-dom";

import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import { useSharedNote } from "../lib/api";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SharedNotePage() {
  const { token } = useParams();
  const noteQuery = useSharedNote(token);

  if (noteQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">分享笔记加载中...</p>;
  }

  if (noteQuery.isError || !noteQuery.data) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-destructive">
          分享笔记加载失败：{noteQuery.error instanceof Error ? noteQuery.error.message : "链接不可用"}
        </p>
        <Link to="/notes" className="text-sm text-primary hover:underline">
          返回笔记
        </Link>
      </section>
    );
  }

  const note = noteQuery.data;
  const source = [note.course_title, note.chapter_title].filter(Boolean).join(" / ");

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <Link to="/notes" className="text-sm text-primary hover:underline">
        返回笔记
      </Link>
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-semibold">{note.title || "未命名笔记"}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          作者：{note.user.username} / {formatDate(note.updated_at)}
          {source ? ` / ${source}` : ""}
        </p>
        {note.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-info-surface px-2 py-1 text-xs text-info">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <MarkdownRenderer content={note.content} />
    </section>
  );
}
