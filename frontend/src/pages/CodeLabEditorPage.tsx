import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { TestCaseEditor } from "../components/codelab/TestCaseEditor";
import { MarkdownRenderer } from "../components/course/MarkdownRenderer";
import {
  CodeLabCreateInput,
  CodeLabTestCaseInput,
  useCourse,
  useCourses,
  useCreateCodeLab,
  useTeacherCodeLab,
  useUpdateCodeLab,
} from "../lib/api";

const defaultCode = {
  python: "n = int(input())\nprint(n)\n",
  javascript: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nconsole.log(input);\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n  long long n;\n  cin >> n;\n  cout << n << '\\n';\n  return 0;\n}\n",
};

function defaultTestCase(): CodeLabTestCaseInput {
  return {
    name: "样例 1",
    input_data: "",
    expected_output: "",
    is_hidden: false,
    points: 10,
    order_index: 0,
  };
}

export function CodeLabEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const coursesQuery = useCourses(1, 100);
  const teacherCodeLabQuery = useTeacherCodeLab(id);
  const createMutation = useCreateCodeLab();
  const updateMutation = useUpdateCodeLab();
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState<CodeLabCreateInput>({
    title: "",
    description: "## 题目描述\n\n请在这里填写题目要求。\n\n## 输入格式\n\n\n## 输出格式\n\n",
    course_id: searchParams.get("course_id") ?? "",
    chapter_id: searchParams.get("chapter_id"),
    language: "python",
    starter_code: defaultCode.python,
    difficulty: 2,
    time_limit_ms: 30000,
    memory_limit_mb: 256,
    is_published: false,
    test_cases: [defaultTestCase()],
  });
  const selectedCourseQuery = useCourse(form.course_id || undefined);

  useEffect(() => {
    if (!teacherCodeLabQuery.data) {
      return;
    }
    const data = teacherCodeLabQuery.data;
    setForm({
      title: data.title,
      description: data.description,
      course_id: data.course_id,
      chapter_id: data.chapter_id,
      language: data.language,
      starter_code: data.starter_code,
      difficulty: data.difficulty,
      time_limit_ms: data.time_limit_ms,
      memory_limit_mb: data.memory_limit_mb,
      is_published: data.is_published,
      test_cases: data.test_cases.map((item, index) => ({
        name: item.name,
        input_data: item.input_data ?? "",
        expected_output: item.expected_output ?? "",
        is_hidden: item.is_hidden,
        points: item.points,
        order_index: item.order_index ?? index,
      })),
    });
  }, [teacherCodeLabQuery.data]);

  const chapters = selectedCourseQuery.data?.chapters ?? [];
  const totalScore = useMemo(() => form.test_cases.reduce((sum, item) => sum + item.points, 0), [form.test_cases]);
  const isBusy = createMutation.isPending || updateMutation.isPending;

  const updateForm = (patch: Partial<CodeLabCreateInput>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const save = async (publish: boolean) => {
    if (!form.title.trim() || !form.course_id || !form.description.trim() || !form.starter_code.trim()) {
      window.alert("请填写标题、课程、题面和初始代码。");
      return;
    }
    if (!form.test_cases.length) {
      window.alert("至少需要一个测试用例。");
      return;
    }
    const payload = {
      ...form,
      is_published: publish,
      chapter_id: form.chapter_id || null,
      test_cases: form.test_cases.map((item, index) => ({ ...item, order_index: index })),
    };
    const saved = isEdit && id ? await updateMutation.mutateAsync({ id, input: payload }) : await createMutation.mutateAsync(payload);
    navigate(`/codelab/${saved.id}`);
  };

  if (isEdit && teacherCodeLabQuery.isLoading) {
    return <p className="text-sm text-foreground/70">题目加载中...</p>;
  }

  if (teacherCodeLabQuery.isError) {
    return <p className="text-sm text-red-600">{teacherCodeLabQuery.error instanceof Error ? teacherCodeLabQuery.error.message : "加载失败"}</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{isEdit ? "编辑实训题" : "新建实训题"}</h1>
          <p className="text-sm text-foreground/70">配置题面、初始代码、公开样例和隐藏评分用例。</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void save(false)} disabled={isBusy} className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50">
            保存草稿
          </button>
          <button type="button" onClick={() => void save(true)} disabled={isBusy} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            保存并发布
          </button>
        </div>
      </div>

      {(createMutation.isError || updateMutation.isError) ? (
        <p className="text-sm text-red-600">
          {(createMutation.error ?? updateMutation.error) instanceof Error
            ? (createMutation.error ?? updateMutation.error)?.message
            : "保存失败"}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-md border border-border bg-background p-4">
          <label className="block space-y-1 text-sm font-medium">
            标题
            <input value={form.title} onChange={(event) => updateForm({ title: event.target.value })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            课程
            <select
              value={form.course_id}
              onChange={(event) => updateForm({ course_id: event.target.value, chapter_id: null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">选择课程</option>
              {coursesQuery.data?.data.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium">
            章节
            <select
              value={form.chapter_id ?? ""}
              onChange={(event) => updateForm({ chapter_id: event.target.value || null })}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">不关联章节</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm font-medium">
              语言
              <select
                value={form.language}
                onChange={(event) => {
                  const language = event.target.value as CodeLabCreateInput["language"];
                  updateForm({ language, starter_code: defaultCode[language] });
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="cpp">C++</option>
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              难度
              <input type="number" min={1} max={5} value={form.difficulty} onChange={(event) => updateForm({ difficulty: Number(event.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm font-medium">
              时间 ms
              <input type="number" min={1000} value={form.time_limit_ms} onChange={(event) => updateForm({ time_limit_ms: Number(event.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              内存 MB
              <input type="number" min={64} value={form.memory_limit_mb} onChange={(event) => updateForm({ memory_limit_mb: Number(event.target.value) })} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <p className="text-sm text-foreground/70">当前满分：{totalScore}</p>
        </aside>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background p-4">
            <div className="mb-2 flex justify-between">
              <h2 className="text-sm font-semibold">题面</h2>
              <button type="button" onClick={() => setShowPreview((value) => !value)} className="rounded-md border border-border px-2 py-1 text-xs">
                {showPreview ? "编辑" : "预览"}
              </button>
            </div>
            {showPreview ? (
              <MarkdownRenderer content={form.description} />
            ) : (
              <textarea value={form.description} onChange={(event) => updateForm({ description: event.target.value })} className="min-h-56 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm" />
            )}
          </div>

          <label className="block space-y-2 rounded-md border border-border bg-background p-4 text-sm font-medium">
            初始代码
            <textarea value={form.starter_code} onChange={(event) => updateForm({ starter_code: event.target.value })} className="min-h-56 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm" />
          </label>

          <div className="rounded-md border border-border bg-background p-4">
            <TestCaseEditor testCases={form.test_cases} onChange={(test_cases) => updateForm({ test_cases })} />
          </div>
        </div>
      </div>
    </section>
  );
}
