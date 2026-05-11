import { useEffect, useMemo, useState } from "react";

import { NoteCard } from "../components/note/NoteCard";
import { NoteDetailDrawer } from "../components/note/NoteDetailDrawer";
import { NoteEditorDialog } from "../components/note/NoteEditorDialog";
import { Note, NoteFilters, useCourses, useDeleteNote, useNotes } from "../lib/api";

type VisibilityFilter = "all" | "private" | "public";

export function NotesPage() {
  const [page, setPage] = useState(1);
  const [courseId, setCourseId] = useState("");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [activeTag, setActiveTag] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const pageSize = 20;

  const coursesQuery = useCourses(1, 100);
  const deleteNoteMutation = useDeleteNote();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 500);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = useMemo<NoteFilters>(() => {
    return {
      course_id: courseId || undefined,
      is_public: visibility === "all" ? undefined : visibility === "public",
      tags: activeTag ? [activeTag] : undefined,
      q: debouncedSearch || undefined,
    };
  }, [activeTag, courseId, debouncedSearch, visibility]);

  const notesQuery = useNotes(filters, page, pageSize);
  const notes = notesQuery.data?.data ?? [];
  const tagCloud = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach((note) => note.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).slice(0, 18);
  }, [notes]);

  async function handleDelete(note: Note): Promise<void> {
    if (!window.confirm("确定删除这条笔记吗？")) {
      return;
    }
    setErrorMessage("");
    try {
      await deleteNoteMutation.mutateAsync(note.id);
      if (selectedNote?.id === note.id) {
        setSelectedNote(null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "删除失败，请稍后再试。");
    }
  }

  function openEditor(note?: Note): void {
    setEditingNote(note ?? null);
    setEditorOpen(true);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">笔记</h1>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="搜索标题与内容"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm md:w-80"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 rounded-lg border border-border bg-background p-4">
          <div>
            <p className="mb-2 text-sm font-semibold">课程</p>
            <select
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">全部课程</option>
              {(coursesQuery.data?.data ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">可见性</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {(["all", "private", "public"] as VisibilityFilter[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setVisibility(item);
                    setPage(1);
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs ${visibility === item ? "bg-background shadow-sm" : ""}`}
                >
                  {item === "all" ? "全部" : item === "private" ? "私有" : "公开"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">标签</p>
            <div className="flex flex-wrap gap-2">
              {tagCloud.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setActiveTag(activeTag === tag ? "" : tag);
                    setPage(1);
                  }}
                  className={`rounded-full border px-2 py-1 text-xs ${
                    activeTag === tag ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                >
                  {tag}
                </button>
              ))}
              {!tagCloud.length ? <span className="text-xs text-foreground/55">暂无标签</span> : null}
            </div>
          </div>
        </aside>

        <div className="space-y-3">
          {notesQuery.isLoading ? <p className="text-sm text-foreground/70">笔记加载中...</p> : null}
          {notesQuery.isError ? <p className="text-sm text-red-600">笔记加载失败：{notesQuery.error.message}</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
            {notes.map((note) => (
              <div key={note.id} className="mb-4">
                <NoteCard note={note} onOpen={setSelectedNote} onEdit={openEditor} onDelete={(item) => void handleDelete(item)} />
              </div>
            ))}
          </div>

          {!notesQuery.isLoading && !notes.length ? <p className="text-sm text-foreground/60">还没有匹配的笔记。</p> : null}

          {notesQuery.data ? (
            <div className="flex items-center justify-end gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-border px-3 py-1 text-sm disabled:opacity-40">
                上一页
              </button>
              <span className="text-sm text-foreground/70">第 {page} 页</span>
              <button type="button" disabled={page * pageSize >= notesQuery.data.meta.total} onClick={() => setPage((value) => value + 1)} className="rounded border border-border px-3 py-1 text-sm disabled:opacity-40">
                下一页
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <button type="button" onClick={() => openEditor()} className="fixed bottom-8 right-8 z-30 rounded-full border border-black bg-background px-5 py-3 text-sm font-semibold shadow-lg">
        新建笔记
      </button>

      <NoteEditorDialog open={editorOpen} note={editingNote} onClose={() => setEditorOpen(false)} onSaved={setSelectedNote} />
      <NoteDetailDrawer note={selectedNote} open={Boolean(selectedNote)} onClose={() => setSelectedNote(null)} onEdit={openEditor} onDelete={(note) => void handleDelete(note)} />
    </section>
  );
}
