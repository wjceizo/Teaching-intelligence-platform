import { useEffect, useState } from "react";

import { MarkdownRenderer } from "../course/MarkdownRenderer";
import { Note, NoteShareInput, useCreateNoteShare } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";

interface NoteDetailDrawerProps {
  note: Note | null;
  open: boolean;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NoteDetailDrawer({ note, open, onClose, onEdit, onDelete }: NoteDetailDrawerProps) {
  const user = useAuthStore((state) => state.user);
  const [copyMessage, setCopyMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [expiresInHours, setExpiresInHours] = useState<1 | 24 | 168>(24);
  const createShareMutation = useCreateNoteShare();

  useEffect(() => {
    setCopyMessage("");
    setShareUrl("");
    setExpiresInHours(24);
  }, [note?.id, open]);

  if (!open || !note) {
    return null;
  }

  const source = [note.course_title, note.chapter_title].filter(Boolean).join(" / ");
  const canManage = user?.id === note.user_id;

  async function handleShare(): Promise<void> {
    if (!note) {
      return;
    }
    try {
      const input: NoteShareInput = note.is_public ? {} : { expires_in_hours: expiresInHours };
      const share = await createShareMutation.mutateAsync({ noteId: note.id, input });
      const nextShareUrl = `${window.location.origin}${share.share_url}`;
      await navigator.clipboard.writeText(nextShareUrl);
      setShareUrl(nextShareUrl);
      setCopyMessage("分享链接已复制");
    } catch (error) {
      setCopyMessage(error instanceof Error ? error.message : "生成分享链接失败");
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white text-slate-900">
      <section className="mx-auto max-w-4xl space-y-5 px-6 py-6">
        <button type="button" onClick={onClose} className="text-sm text-blue-600 hover:underline">
          返回笔记
        </button>

        <header className="border-b border-slate-200 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{note.title || "未命名笔记"}</h1>
              <p className="mt-2 text-xs text-slate-500">
                作者：{note.user.username} · {formatDate(note.updated_at)}
                {source ? ` · ${source}` : ""}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canManage ? (
              <button
                type="button"
                onClick={() => onEdit(note)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                编辑
              </button>
            ) : null}
            {canManage && !note.is_public ? (
              <select
                value={expiresInHours}
                onChange={(event) => setExpiresInHours(Number(event.target.value) as 1 | 24 | 168)}
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value={1}>1小时</option>
                <option value={24}>1天</option>
                <option value={168}>7天</option>
              </select>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => void handleShare()}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                {createShareMutation.isPending ? "生成中..." : "分享"}
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                onClick={() => onDelete(note)}
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                删除
              </button>
            ) : null}
            <span className="rounded-full border border-border px-2 py-1 text-xs text-foreground/65">
              {note.is_public ? "公开" : "私有"}
            </span>
            {copyMessage ? <span className="text-xs text-slate-500">{copyMessage}</span> : null}
          </div>
          {note.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-700">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {shareUrl ? (
            <input
              readOnly
              value={shareUrl}
              className="mt-3 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs"
            />
          ) : null}
        </header>

        <MarkdownRenderer content={note.content} />
      </section>
    </div>
  );
}
