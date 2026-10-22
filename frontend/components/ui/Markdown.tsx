import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type Level = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingTag = `h${Level}`;

type Props = {
  children: string | null;
  className?: string;
  /**
   * Heading level a markdown `#` becomes. Admin-written markdown sits inside a chapter (h2) or a
   * story block (h3), so its headings are shifted down to keep the page outline in order.
   */
  headingLevel?: Level;
};

function shiftedHeadings(base: Level): Components {
  const headings: Partial<Components> = {};
  for (let depth = 1; depth <= 6; depth++) {
    const level = Math.min(6, base + depth - 1) as Level;
    const Tag: HeadingTag = `h${level}`;
    headings[`h${depth}` as HeadingTag] = ({ children }: { children?: ReactNode }) => (
      <Tag className="font-bold">{children}</Tag>
    );
  }
  return headings as Components;
}

/** Every markdown field from the API goes through here (sanitised, spec §11). */
export function Markdown({ children, className, headingLevel = 4 }: Props) {
  if (!children?.trim()) return null;
  return (
    <div className={cn("hk-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          ...shiftedHeadings(headingLevel),
          a: ({ href, children: label }) => {
            const external = href?.startsWith("http");
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {label}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
