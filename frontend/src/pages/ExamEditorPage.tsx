import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  ExamInput,
  ExamQuestionInPaperInput,
  ExamResultPolicy,
  useCourses,
  useCreateExam,
  useExam,
  useExamQuestions,
  useUpdateExam,
} from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function ExamEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isEdit = Boolean(id);
  const examQuery = useExam(id);
  const coursesQuery = useCourses(1, 100);
  const createMutation = useCreateExam();
  const updateMutation = useUpdateExam();
  const [form, setForm] = useState({
    course_id: searchParams.get("course_id") ?? "",
    chapter_id: searchParams.get("chapter_id") ?? "",
    title: "",
    description: "",
    total_score: 100,
    pass_score: 60,
    time_limit_minutes: 30,
    max_attempts: 1,
    is_shuffled: false,
    show_result_policy: "after_submit" as ExamResultPolicy,
    status: "draft" as "draft" | "published" | "closed",
  });
  const [selectedQuestions, setSelectedQuestions] = useState<ExamQuestionInPaperInput[]>([]);
  const questionsQuery = useExamQuestions({ course_id: form.course_id || undefined }, 1, 100);
  const selectableCourses = coursesQuery.data?.data.filter((course) => user?.role === "admin" || course.teacher_id === user?.id) ?? [];
  const selectedCourse = useMemo(() => selectableCourses.find((course) => course.id === form.course_id), [form.course_id, selectableCourses]);
  const pointSum = selectedQuestions.reduce((sum, item) => sum + item.points, 0);
  const saveError = createMutation.error ?? updateMutation.error;

  useEffect(() => {
    if (!examQuery.data || !isEdit) return;
    const exam = examQuery.data;
    setForm({
      course_id: exam.course_id,
      chapter_id: exam.chapter_id ?? "",
      title: exam.title,
      description: exam.description ?? "",
      total_score: exam.total_score,
      pass_score: exam.pass_score,
      time_limit_minutes: exam.time_limit_minutes,
      max_attempts: exam.max_attempts,
      is_shuffled: exam.is_shuffled,
      show_result_policy: exam.show_result_policy,
      status: exam.status,
    });
    setSelectedQuestions(exam.questions.map((item) => ({ question_id: item.question_id, points: item.points, order_index: item.order_index })));
  }, [examQuery.data, isEdit]);

  useEffect(() => {
    if (!form.course_id && selectableCourses[0]) {
      setForm((current) => ({ ...current, course_id: selectableCourses[0].id }));
    }
  }, [form.course_id, selectableCourses]);

  const addQuestion = (questionId: string) => {
    if (selectedQuestions.some((item) => item.question_id === questionId)) return;
    setSelectedQuestions((current) => [
      ...current,
      { question_id: questionId, points: Math.max(1, Math.floor(form.total_score / Math.max(1, current.length + 1))), order_index: current.length },
    ]);
  };

  const handleSubmit = (event: { preventDefault: () => void }, publish: boolean) => {
    event.preventDefault();
    if (publish && pointSum !== form.total_score) {
      window.alert("题目分值合计必须等于总分。");
      return;
    }
    const input: ExamInput = {
      course_id: form.course_id,
      chapter_id: form.chapter_id || null,
      title: form.title,
      description: form.description || null,
      total_score: form.total_score,
      pass_score: form.pass_score,
      time_limit_minutes: form.time_limit_minutes,
      max_attempts: form.max_attempts,
      is_shuffled: form.is_shuffled,
      show_result_policy: form.show_result_policy,
      questions: selectedQuestions.map((item, index) => ({ ...item, order_index: index })),
      status: publish ? "published" : form.status === "closed" ? "closed" : "draft",
    };
    if (isEdit && id) {
      updateMutation.mutate({ id, input }, { onSuccess: (exam) => navigate(`/exam/${exam.id}`) });
    } else {
      createMutation.mutate(input, { onSuccess: (exam) => navigate(`/exam/${exam.id}`) });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isEdit ? "编辑测验" : "新建测验"}</h1>
          <p className="text-sm text-muted-foreground">配置题目、分值、时间和结果公布方式。</p>
        </div>
        <Link to="/exam/questions" className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">题库</Link>
      </div>

      <form className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-3 rounded-md border border-border bg-surface p-4">
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required placeholder="测验标题" className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
          <div className="grid gap-3 md:grid-cols-2">
            <select value={form.course_id} onChange={(event) => setForm((current) => ({ ...current, course_id: event.target.value, chapter_id: "" }))} required className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
              <option value="">选择课程</option>
              {selectableCourses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
            <select value={form.chapter_id} onChange={(event) => setForm((current) => ({ ...current, chapter_id: event.target.value }))} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
              <option value="">不关联章节</option>
              {selectedCourse?.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
            </select>
          </div>
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={5} placeholder="测验说明，支持 Markdown" className="w-full rounded-md border border-border bg-surface p-3 text-sm" />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">总分<input type="number" min={1} value={form.total_score} onChange={(event) => setForm((current) => ({ ...current, total_score: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            <label className="text-sm">及格分<input type="number" min={0} value={form.pass_score} onChange={(event) => setForm((current) => ({ ...current, pass_score: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            <label className="text-sm">限时分钟<input type="number" min={1} value={form.time_limit_minutes} onChange={(event) => setForm((current) => ({ ...current, time_limit_minutes: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            <label className="text-sm">次数<input type="number" min={1} value={form.max_attempts} onChange={(event) => setForm((current) => ({ ...current, max_attempts: Number(event.target.value) }))} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2" /></label>
            <label className="text-sm">结果公布
              <select value={form.show_result_policy} onChange={(event) => setForm((current) => ({ ...current, show_result_policy: event.target.value as ExamResultPolicy }))} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2">
                <option value="after_submit">提交后</option>
                <option value="after_end">结束后</option>
                <option value="manual">手动公布</option>
              </select>
            </label>
            <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_shuffled} onChange={(event) => setForm((current) => ({ ...current, is_shuffled: event.target.checked }))} />题目乱序</label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">已选题目</h2>
              <span className={pointSum === form.total_score ? "text-sm text-success" : "text-sm text-destructive"}>{pointSum} / {form.total_score}</span>
            </div>
            <div className="space-y-2">
              {selectedQuestions.map((item, index) => {
                const question = questionsQuery.data?.data.find((candidate) => candidate.id === item.question_id) ?? examQuery.data?.questions.find((candidate) => candidate.question_id === item.question_id)?.question;
                return (
                  <div key={item.question_id} className="grid gap-2 rounded-md border border-border p-3 text-sm md:grid-cols-[1fr_100px_60px]">
                    <span className="truncate">{index + 1}. {question?.content ?? item.question_id}</span>
                    <input type="number" min={1} value={item.points} onChange={(event) => setSelectedQuestions((current) => current.map((candidate) => candidate.question_id === item.question_id ? { ...candidate, points: Number(event.target.value) } : candidate))} className="rounded border border-border bg-surface px-2 py-1" />
                    <button type="button" onClick={() => setSelectedQuestions((current) => current.filter((candidate) => candidate.question_id !== item.question_id))} className="rounded border border-destructive px-2 py-1 text-destructive">移除</button>
                  </div>
                );
              })}
              {selectedQuestions.length === 0 ? <p className="text-sm text-muted-foreground">请从右侧题库加入题目。</p> : null}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={(event) => handleSubmit(event, false)} className="rounded-md border border-border px-3 py-2 text-sm">保存草稿</button>
            <button type="button" onClick={(event) => handleSubmit(event, true)} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">保存并发布</button>
          </div>
          {saveError ? (
            <p className="text-sm text-destructive">
              保存失败：{saveError instanceof Error ? saveError.message : "请检查课程权限、题目数量和分值合计。"}
            </p>
          ) : null}
        </div>

        <aside className="space-y-2 rounded-md border border-border bg-surface p-4">
          <h2 className="font-semibold">题库选择</h2>
          {questionsQuery.data?.data.map((question) => (
            <button key={question.id} type="button" onClick={() => addQuestion(question.id)} className="block w-full rounded-md border border-border p-3 text-left text-sm hover:border-primary">
              <span className="font-medium">{question.type} · 难度 {question.difficulty}</span>
              <span className="mt-1 block line-clamp-2 text-muted-foreground">{question.content}</span>
            </button>
          ))}
          {questionsQuery.data?.data.length === 0 ? <p className="text-sm text-muted-foreground">当前课程暂无题目，请先去题库创建。</p> : null}
        </aside>
      </form>
    </section>
  );
}
