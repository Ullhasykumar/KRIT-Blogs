import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy } from 'lucide-react';

interface MarkdownRenderProps {
  content: string;
}

export default function MarkdownRender({ content }: MarkdownRenderProps) {
  return (
    <div className="prose-custom">
      <ReactMarkdown
        components={{
          // Code block customization (with inline option handled correctly)
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;
            const codeString = String(children).replace(/\n$/, '');

            if (isInline) {
              return (
                <code className="bg-neutral-800/10 dark:bg-neutral-200/10 px-1.5 py-0.5 rounded font-mono text-sm border border-neutral-200/20 dark:border-neutral-800/20" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock language={match ? match[1] : 'text'} code={codeString} />
            );
          },
          // Customize footnotes, lists, and headers if needed
          h2({ children, ...props }) {
            // Anchor-ready ID generation
            const id = String(children)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '');
            return (
              <h2 id={id} className="text-2xl font-serif mt-10 mb-4 group cursor-pointer" {...props}>
                <span className="text-neutral-400 font-mono text-sm mr-2 font-light">
                  //
                </span>
                {children}
              </h2>
            );
          },
          hr() {
            return <hr className="my-10 border-t border-dashed border-(--border)" />;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-neutral-400 dark:border-neutral-600 pl-4 my-8 italic text-neutral-500 font-serif text-lg">
                {children}
              </blockquote>
            );
          },
          a({ href, children }) {
            const isExternal = href?.startsWith('http');
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="underline underline-offset-4 decoration-neutral-400 hover:decoration-neutral-800 dark:decoration-neutral-600 dark:hover:decoration-neutral-200 transition-colors duration-200 font-medium"
              >
                {children}
                {isExternal && <span className="inline-block text-xs ml-0.5 select-none opacity-60">↗</span>}
              </a>
            );
          },
          img({ src, alt }) {
            return (
              <span className="block my-8 space-y-2">
                <img
                  src={src}
                  alt={alt}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[420px] object-cover rounded-md border border-(--border) shadow-sm bg-(--bg-surface)"
                />
                {alt && (
                  <span className="block text-center font-mono text-xs text-(--text-secondary) opacity-80">
                    ↗ Diagram: {alt}
                  </span>
                )}
              </span>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  return (
    <div className="relative group my-6 border border-(--border) rounded-md overflow-hidden bg-(--bg-surface) transition-colors duration-200">
      {/* Code Header Bar resembling clean handwritten design */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-(--border) bg-neutral-100/50 dark:bg-neutral-900/50">
        <span className="text-xs font-mono text-(--text-secondary) uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="p-1 rounded text-(--text-secondary) hover:text-(--text-primary) hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-all duration-200"
          title="Copy code"
        >
          {copied ? (
            <span className="flex items-center text-xs font-mono text-emerald-500 gap-1">
              <Check className="w-3.5 h-3.5" /> copied
            </span>
          ) : (
            <span className="flex items-center text-xs font-mono gap-1">
              <Copy className="w-3.5 h-3.5" /> copy
            </span>
          )}
        </button>
      </div>

      {/* Code Area */}
      <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed bg-(--bg-surface) text-(--text-primary)">
        <code>{code}</code>
      </pre>
    </div>
  );
}
