import { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownRendererProps {
  content: string;
  enableParagraphAsk?: boolean;
  onAskParagraph?: (paragraphText: string) => void;
}

function flattenText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((item) => flattenText(item)).join("");
  }
  if (node && typeof node === "object" && "props" in node) {
    const withProps = node as { props?: { children?: ReactNode } };
    return flattenText(withProps.props?.children ?? "");
  }
  return "";
}

export function MarkdownRenderer({
  content,
  enableParagraphAsk = false,
  onAskParagraph,
}: MarkdownRendererProps) {
  return (
    <div className="prose prose-slate max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => {
            const paragraphText = flattenText(children).trim();
            return (
              <p className="group relative leading-7">
                {children}
                {enableParagraphAsk && paragraphText ? (
                  <button
                    type="button"
                    onClick={() => onAskParagraph?.(paragraphText)}
                    className="absolute -right-10 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-2 py-1 text-xs group-hover:block"
                  >
                    提问
                  </button>
                ) : null}
              </p>
            );
          },
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");

            if (!match) {
              return <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">{children}</code>;
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
