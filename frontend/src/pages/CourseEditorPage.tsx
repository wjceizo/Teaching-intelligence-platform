import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import {
  ChapterSummary,
  useChapterContent,
  useCourse,
  useCreateChapter,
  useDeleteChapter,
  useReorderChapters,
  useUpdateChapter,
  useUpdateCourse,
} from "../lib/api";
import { useAuthStore } from "../stores/authStore";

interface SortableChapterItemProps {
  chapter: ChapterSummary;
  isActive: boolean;
  onSelect: (chapterId: string) => void;
}

function SortableChapterItem({ chapter, isActive, onSelect }: SortableChapterItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: chapter.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border px-2 py-2 ${
        isActive ? "border-primary bg-primary/10 text-primary" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(chapter.id)}
        className="min-w-0 flex-1 text-left text-sm hover:text-primary"
      >
        <span className="block truncate">
          {chapter.order_index + 1}. {chapter.title}
        </span>
      </button>
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab rounded border border-border px-2 py-1 text-xs text-foreground/70"
      >
        拖拽
      </button>
    </div>
  );
}

function parseMarkdownSections(markdown: string): Array<{ title: string; content: string }> {
  const lines = markdown.split(/\r?\n/);
  const sections: Array<{ title: string; content: string }> = [];
  let currentTitle = "";
  let currentContent: string[] = [];

  const flush = () => {
    if (!currentTitle) {
      return;
    }
    sections.push({
      title: currentTitle.trim(),
      content: currentContent.join("\n").trim() || "（空白章节）",
    });
  };

  for (const line of lines) {
    const headingMatch = line.match(/^##(?!#)\s*(.+)$/);
    if (headingMatch) {
      flush();
      currentTitle = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  flush();
  return sections.filter((item) => item.title.length > 0);
}

async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("文件读取失败"));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("图片读取失败"));
      }
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function CourseEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const courseQuery = useCourse(id);
  const createChapterMutation = useCreateChapter();
  const updateChapterMutation = useUpdateChapter();
  const deleteChapterMutation = useDeleteChapter();
  const reorderMutation = useReorderChapters();
  const updateCourseMutation = useUpdateCourse();

  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [hasPendingChange, setHasPendingChange] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [coverDraft, setCoverDraft] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState("");

  const chapterContentQuery = useChapterContent(selectedChapterId ?? undefined);
  const sensors = useSensors(useSensor(PointerSensor));
  const lastLoadedChapterIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!courseQuery.data) {
      return;
    }
    setChapters(courseQuery.data.chapters);
    setSelectedChapterId((previous) => previous ?? courseQuery.data?.chapters[0]?.id ?? null);
    setCoverDraft(courseQuery.data.cover_image);
  }, [courseQuery.data]);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? null,
    [chapters, selectedChapterId]
  );

  const canEdit =
    user?.role === "admin" || (user?.role === "teacher" && user.id === courseQuery.data?.teacher_id);

  useEffect(() => {
    if (!selectedChapterId) {
      setDraftTitle("");
      setDraftContent("");
      setHasPendingChange(false);
      return;
    }
    const chapter = chapters.find((item) => item.id === selectedChapterId);
    if (!chapter) {
      return;
    }
    setDraftTitle(chapter.title);
    lastLoadedChapterIdRef.current = null;
  }, [selectedChapterId, chapters]);

  useEffect(() => {
    if (!selectedChapterId || !chapterContentQuery.data) {
      return;
    }
    if (lastLoadedChapterIdRef.current === selectedChapterId) {
      return;
    }
    lastLoadedChapterIdRef.current = selectedChapterId;
    setDraftContent(chapterContentQuery.data.content);
    setHasPendingChange(false);
  }, [chapterContentQuery.data, selectedChapterId]);

  const saveCurrentChapter = () => {
    if (!selectedChapterId) {
      return;
    }
    updateChapterMutation.mutate(
      {
        chapterId: selectedChapterId,
        input: {
          title: draftTitle,
          content: draftContent,
        },
      },
      {
        onSuccess: (chapter) => {
          setChapters((previous) =>
            previous.map((item) =>
              item.id === chapter.id
                ? {
                    ...item,
                    title: chapter.title,
                    order_index: chapter.order_index,
                  }
                : item
            )
          );
          setHasPendingChange(false);
        },
      }
    );
  };

  useEffect(() => {
    if (!autoSaveEnabled || !selectedChapterId || !hasPendingChange) {
      return;
    }
    const timer = setTimeout(() => {
      saveCurrentChapter();
    }, 800);
    return () => clearTimeout(timer);
  }, [autoSaveEnabled, draftContent, draftTitle, hasPendingChange, selectedChapterId]);

  const handleAddChapter = async () => {
    if (!id) {
      return;
    }
    const created = await createChapterMutation.mutateAsync({
      courseId: id,
      input: {
        title: `新章节 ${chapters.length + 1}`,
        content: "## 新章节\n\n请在这里编辑章节内容。",
        order_index: chapters.length,
      },
    });
    setChapters((previous) => [...previous, created]);
    setSelectedChapterId(created.id);
  };

  const handleDeleteChapter = () => {
    if (!selectedChapterId) {
      return;
    }
    const ok = window.confirm("确认删除当前章节？");
    if (!ok) {
      return;
    }
    deleteChapterMutation.mutate(
      { chapterId: selectedChapterId },
      {
        onSuccess: () => {
          setChapters((previous) => {
            const remaining = previous.filter((chapter) => chapter.id !== selectedChapterId);
            setSelectedChapterId(remaining[0]?.id ?? null);
            return remaining;
          });
        },
      }
    );
  };

  const handleImportMarkdown = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!id) {
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await readTextFile(file);
    const sections = parseMarkdownSections(text);
    if (!sections.length) {
      window.alert("未解析到章节。请使用二级标题 ## 作为章节分隔。");
      event.target.value = "";
      return;
    }

    let currentIndex = chapters.length;
    const createdItems: ChapterSummary[] = [];
    for (const section of sections) {
      const created = await createChapterMutation.mutateAsync({
        courseId: id,
        input: {
          title: section.title,
          content: section.content,
          order_index: currentIndex,
        },
      });
      createdItems.push(created);
      currentIndex += 1;
    }

    setChapters((previous) => [...previous, ...createdItems]);
    setSelectedChapterId(createdItems[0]?.id ?? selectedChapterId);
    event.target.value = "";
  };

  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!id) {
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setCoverDraft(dataUrl);
    setCoverFileName(file.name);
    updateCourseMutation.mutate({
      id,
      input: {
        cover_image: dataUrl,
      },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setChapters((previous) => {
      const oldIndex = previous.findIndex((item) => item.id === active.id);
      const newIndex = previous.findIndex((item) => item.id === over.id);
      const moved = arrayMove(previous, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order_index: index,
      }));

      if (id) {
        reorderMutation.mutate({
          courseId: id,
          chapters: moved.map((item) => ({ id: item.id, order_index: item.order_index })),
        });
      }
      return moved;
    });
  };

  if (!id) {
    return <p>课程不存在。</p>;
  }

  if (courseQuery.isLoading) {
    return <p className="text-sm text-foreground/70">编辑器加载中...</p>;
  }

  if (courseQuery.isError || !courseQuery.data) {
    return (
      <p className="text-sm text-red-600">
        编辑器加载失败：{courseQuery.error instanceof Error ? courseQuery.error.message : "未知错误"}
      </p>
    );
  }

  if (!canEdit) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">课程编辑器</h1>
        <p className="text-sm text-red-600">你没有权限编辑这门课程。</p>
        <button
          type="button"
          onClick={() => navigate(`/courses/${id}`)}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          返回课程详情
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">课程编辑器：{courseQuery.data.title}</h1>
        <button
          type="button"
          onClick={() => navigate(`/courses/${id}`)}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          返回课程详情
        </button>
      </div>

      <div className="flex gap-4">
        <aside className="w-80 shrink-0 rounded-xl border border-border bg-background p-3">
          <div className="mb-4 rounded-md border border-border p-3">
            <p className="mb-2 text-sm font-medium">课程封面</p>
            <div className="mb-2">
              {coverDraft ? (
                <img src={coverDraft} alt="课程封面预览" className="h-28 w-full rounded object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center rounded bg-muted text-xs text-foreground/70">
                  暂无封面
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-xs hover:bg-muted">
                选择课程封面
                <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              </label>
              <span className="text-xs text-foreground/70">{coverFileName || "未选择文件"}</span>
            </div>
            <p className="mt-2 text-xs text-foreground/60">
              {updateCourseMutation.isPending ? "封面保存中..." : "选择后自动保存封面"}
            </p>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleAddChapter()}
              disabled={createChapterMutation.isPending}
              className="rounded-md border border-black bg-transparent px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {createChapterMutation.isPending ? "添加中..." : "添加章节"}
            </button>
            <label className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
              导入 Markdown
              <input type="file" accept=".md,text/markdown" onChange={handleImportMarkdown} className="hidden" />
            </label>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={chapters.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {chapters.map((chapter) => (
                  <SortableChapterItem
                    key={chapter.id}
                    chapter={chapter}
                    isActive={chapter.id === selectedChapterId}
                    onSelect={setSelectedChapterId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </aside>

        <div className="min-w-0 flex-1 rounded-xl border border-border bg-background p-4">
          {selectedChapter ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <input
                  value={draftTitle}
                  onChange={(event) => {
                    setDraftTitle(event.target.value);
                    setHasPendingChange(true);
                  }}
                  className="w-full max-w-lg rounded-md border border-border bg-background px-3 py-2 text-lg font-semibold"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPreview(false)}
                    className={`rounded-md px-3 py-1 text-sm ${!isPreview ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreview(true)}
                    className={`rounded-md px-3 py-1 text-sm ${isPreview ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}
                  >
                    预览
                  </button>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={(event) => setAutoSaveEnabled(event.target.checked)}
                  />
                  自动保存
                </label>
                <button
                  type="button"
                  onClick={saveCurrentChapter}
                  disabled={updateChapterMutation.isPending || !hasPendingChange}
                  className="rounded-md border border-black bg-transparent px-3 py-1 text-sm font-medium text-black disabled:opacity-50"
                >
                  保存修改
                </button>
                <button
                  type="button"
                  onClick={handleDeleteChapter}
                  disabled={deleteChapterMutation.isPending}
                  className="rounded-md border border-red-600 bg-red-50 px-3 py-1 text-sm font-medium text-red-700 disabled:opacity-50"
                >
                  {deleteChapterMutation.isPending ? "删除中..." : "删除当前章节"}
                </button>
              </div>

              {isPreview ? (
                <MarkdownRenderer content={draftContent} />
              ) : (
                <textarea
                  value={draftContent}
                  onChange={(event) => {
                    setDraftContent(event.target.value);
                    setHasPendingChange(true);
                  }}
                  className="min-h-[480px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
                />
              )}

              <div className="mt-3 text-xs text-foreground/70">
                {updateChapterMutation.isPending
                  ? "保存中..."
                  : hasPendingChange
                    ? "有未保存修改"
                    : "所有修改已保存"}
              </div>
            </>
          ) : (
            <p className="text-sm text-foreground/70">请先添加或选择一个章节。</p>
          )}
        </div>
      </div>
    </section>
  );
}
