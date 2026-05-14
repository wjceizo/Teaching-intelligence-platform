import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";

interface CodeEditorProps {
  code: string;
  language: "python" | "javascript" | "cpp";
  isBusy: boolean;
  onChange: (code: string) => void;
  onReset: () => void;
  onRun: () => void;
  onSubmit: () => void;
}

function monacoLanguage(language: CodeEditorProps["language"]) {
  if (language === "javascript") {
    return "javascript";
  }
  if (language === "cpp") {
    return "cpp";
  }
  return "python";
}

export function CodeEditor({ code, language, isBusy, onChange, onReset, onRun, onSubmit }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) {
      return;
    }

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: code,
      language: monacoLanguage(language),
      theme: "vs-dark",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
    });

    const subscription = editorRef.current.onDidChangeModelContent(() => {
      onChange(editorRef.current?.getValue() ?? "");
    });

    return () => {
      subscription.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.getValue() === code) {
      return;
    }
    const position = editor.getPosition();
    editor.setValue(code);
    if (position) {
      editor.setPosition(position);
    }
  }, [code]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, monacoLanguage(language));
    }
  }, [language]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-4 z-50 flex flex-col rounded-md border border-border bg-background shadow-xl"
          : "flex min-h-[520px] flex-col rounded-md border border-border bg-background"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-2 py-1 text-xs font-medium uppercase">{language}</span>
          <button type="button" onClick={onReset} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">
            重置
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen((value) => !value)}
            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            {isFullscreen ? "退出全屏" : "全屏"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRun}
            disabled={isBusy}
            className="rounded-md border border-border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
          >
            {isBusy ? "运行中" : "运行样例"}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy}
            className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            提交评分
          </button>
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
