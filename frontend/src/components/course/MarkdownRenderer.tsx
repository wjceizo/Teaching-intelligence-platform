import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-slate max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => (
            <p className="group relative leading-7">
              {children}
              <button
                type="button"
                className="absolute -right-10 top-1/2 hidden -translate-y-1/2 rounded border border-border px-2 py-1 text-xs group-hover:block"
              >
                提问
              </button>
            </p>
          ),
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");

            if (!match) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                style={oneLight}
                language={match[1]}
                PreTag="div"
                customStyle={{ borderRadius: 10, marginTop: 8, marginBottom: 8 }}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
