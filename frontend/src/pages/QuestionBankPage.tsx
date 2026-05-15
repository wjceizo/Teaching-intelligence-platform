import { FormEvent, useMemo, useState } from "react";

import {
  ExamAnswerValue,
  ExamQuestion,
  ExamQuestionInput,
  ExamQuestionType,
  useCourses,
  useCreateExamQuestion,
  useDeleteExamQuestion,
  useExamQuestions,
  useUpdateExamQuestion,
} from "../lib/api";
import { useAuthStore } from "../stores/authStore";

const defaultOptions = [
  { id: "A", label: "A", content: "" },
  { id: "B", label: "B", content: "" },
  { id: "C", label: "C", content: "" },
  { id: "D", label: "D", content: "" },
];

function parseAnswer(type: ExamQuestionType, raw: string): ExamAnswerValue {
  if (type === "multi" || type === "fill") {
    return raw.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
  }
  return raw.trim();
}

export function QuestionBankPage() {
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ExamQuestion | null>(null);
  const [form, setForm] = useState({
    course_id: "",
    chapter_id: "",
    type: "single" as ExamQuestionType,
    content: "",
    options: defaultOptions,
    answer: "",
    explanation: "",
    difficulty: 1,
    tags: "",
  });
  const coursesQuery = useCourses(1, 100);
  const questionsQuery = useExamQuestions({}, page, 20);
  const createMutation = useCreateExamQuestion();
  const updateMutation = useUpdateExamQuestion();
  const deleteMutation = useDeleteExamQuestion();
  const selectableCourses = coursesQuery.data?.data.filter((course) => user?.role === "admin" || course.teacher_id === user?.id) ?? [];
  const selectedCourse = useMemo(
    () => selectableCourses.find((course) => course.id === form.course_id),
    [form.course_id, selectableCourses]
  );

  const resetForm = () => {
    setEditing(null);
    setForm({
      course_id: selectableCourses[0]?.id ?? "",
      chapter_id: "",
      type: "single",
      content: "",
      options: defaultOptions,
      answer: "",
      explanation: "",
      difficulty: 1,
      tags: "",
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const input: ExamQuestionInput = {
      course_id: form.course_id,
      chapter_id: form.chapter_id || null,
      type: form.type,
      content: form.content,
      options: form.type === "single" || form.type === "multi" ? form.options.filter((option) => option.content.trim()) : null,
      answer: parseAnswer(form.type, form.answer),
      explanation: form.explanation || null,
      difficulty: form.difficulty,
      tags: form.tags.split(/[,，、]/).map((item) => item.trim()).filter(Boolean),
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, input }, { onSuccess: resetForm });
    } else {
      createMutation.mutate(input, { onSuccess: resetForm });
    }
  };

  const startEdit = (question: ExamQuestion) => {
    setEditing(question);
    setForm({
      course_id: question.course_id,
      chapter_id: question.chapter_id ?? "",
      type: question.type,
      content: question.content,
      options: question.options?.length ? question.options : defaultOptions,
      answer: Array.isArray(question.answer) ? question.answer.join("、") : String(question.answer ?? ""),
      explanation: question.explanation ?? "",
      difficulty: question.difficulty,
      tags: question.tags.join("、"),
    });
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-border bg-surface p-4">
        <div>
          <h1 className="text-xl font-semibold">{editing ? "编辑题目" : "新建题目"}</h1>
          <p className="text-sm text-muted-foreground">维护课程题库，供试卷组题使用。</p>
        </div>
        <select value={form.course_id} onChange={(event) => setForm((current) => ({ ...current, course_id: event.target.value, chapter_id: "" }))} required className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <option value="">选择课程</option>
          {selectableCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
        <select value={form.chapter_id} onChange={(event) => setForm((current) => ({ ...current, chapter_id: event.target.value }))} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <option value="">不关联章节</option>
          {selectedCourse?.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
        </select>
        <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as ExamQuestionType }))} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm">
          <option value="single">单选</option>
          <option value="multi">多选</option>
          <option value="fill">填空</option>
          <option value="short">简答</option>
          <option value="proof">证明</option>
        </select>
        <textarea value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} required rows={5} placeholder="题干，支持 Markdown/LaTeX" className="w-full rounded-md border border-border bg-surface p-3 text-sm" />
        {(form.type === "single" || form.type === "multi") ? (
          <div className="space-y-2">
            {form.options.map((option, index) => (
              <input
                key={option.id}
                value={option.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    options: current.options.map((item, optionIndex) => optionIndex === index ? { ...item, content: event.target.value } : item),
                  }))
                }
                placeholder={`${option.label} 选项内容`}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
            ))}
          </div>
        ) : null}
        <input value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} required placeholder="答案；多选/填空可用顿号或逗号分隔" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
        <textarea value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} rows={3} placeholder="解析" className="w-full rounded-md border border-border bg-surface p-3 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" min={1} max={5} value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: Number(event.target.value) }))} className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
          <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="标签" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">{editing ? "保存修改" : "创建题目"}</button>
          {editing ? <button type="button" onClick={resetForm} className="rounded-md border border-border px-3 py-2 text-sm">取消</button> : null}
        </div>
        {createMutation.isError || updateMutation.isError ? <p className="text-sm text-destructive">保存失败，请检查题型和答案格式。</p> : null}
      </form>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">题库</h2>
          <span className="text-sm text-muted-foreground">第 {page} 页</span>
        </div>
        {questionsQuery.data?.data.map((question) => (
          <div key={question.id} className="rounded-md border border-border bg-surface p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{question.type} · 难度 {question.difficulty}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => startEdit(question)} className="rounded border border-border px-2 py-1 text-xs">编辑</button>
                <button type="button" onClick={() => window.confirm("确认删除/停用该题？") && deleteMutation.mutate(question.id)} className="rounded border border-destructive px-2 py-1 text-xs text-destructive">删除</button>
              </div>
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">{question.content}</p>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border px-3 py-1 text-sm disabled:opacity-50">上一页</button>
          <button type="button" disabled={!questionsQuery.data || page * questionsQuery.data.meta.page_size >= questionsQuery.data.meta.total} onClick={() => setPage((value) => value + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-50">下一页</button>
        </div>
      </div>
    </section>
  );
}
