import { CodeLabTestCaseInput } from "../../lib/api";

interface TestCaseEditorProps {
  testCases: CodeLabTestCaseInput[];
  onChange: (testCases: CodeLabTestCaseInput[]) => void;
}

function emptyTestCase(index: number): CodeLabTestCaseInput {
  return {
    name: `用例 ${index + 1}`,
    input_data: "",
    expected_output: "",
    is_hidden: false,
    points: 10,
    order_index: index,
  };
}

export function TestCaseEditor({ testCases, onChange }: TestCaseEditorProps) {
  const normalized = testCases.length ? testCases : [emptyTestCase(0)];

  const updateItem = (index: number, patch: Partial<CodeLabTestCaseInput>) => {
    onChange(
      normalized.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  };

  const removeItem = (index: number) => {
    if (normalized.length === 1) {
      window.alert("至少保留一个测试用例。");
      return;
    }
    onChange(normalized.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order_index: itemIndex })));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= normalized.length) {
      return;
    }
    const copied = [...normalized];
    const current = copied[index];
    copied[index] = copied[target];
    copied[target] = current;
    onChange(copied.map((item, itemIndex) => ({ ...item, order_index: itemIndex })));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">测试用例</h3>
        <button
          type="button"
          onClick={() => onChange([...normalized, emptyTestCase(normalized.length)])}
          className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted"
        >
          新增用例
        </button>
      </div>

      {normalized.map((item, index) => (
        <div key={index} className={`rounded-md border p-3 ${item.is_hidden ? "border-amber-300 bg-amber-50" : "border-border"}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={item.name}
              onChange={(event) => updateItem(index, { name: event.target.value })}
              className="min-w-[180px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">分数由题目满分平均分配</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.is_hidden}
                onChange={(event) => updateItem(index, { is_hidden: event.target.checked })}
              />
              隐藏
            </label>
            <button type="button" onClick={() => moveItem(index, -1)} className="rounded-md border border-border px-2 py-1 text-xs">
              上移
            </button>
            <button type="button" onClick={() => moveItem(index, 1)} className="rounded-md border border-border px-2 py-1 text-xs">
              下移
            </button>
            <button type="button" onClick={() => removeItem(index)} className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700">
              删除
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-medium">
              输入 stdin
              <textarea
                value={item.input_data}
                onChange={(event) => updateItem(index, { input_data: event.target.value })}
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="space-y-1 text-xs font-medium">
              期望输出 stdout
              <textarea
                value={item.expected_output}
                onChange={(event) => updateItem(index, { expected_output: event.target.value })}
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
