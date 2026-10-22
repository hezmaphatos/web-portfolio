"use client";

import { useState } from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { Textarea } from "@/components/admin/ui/textarea";
import { describedBy, FieldShell } from "@/components/admin/form/FieldShell";
import type { FieldBaseProps } from "@/components/admin/form/types";
import { useBoundField } from "@/components/admin/form/use-bound-field";
import { cn } from "@/lib/utils";

/** Minimal typography for the preview (no typography plugin in the admin bundle). */
export const markdownPreviewClass = cn(
  "text-sm leading-relaxed break-words",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold",
  "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:font-semibold",
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:my-0.5 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold",
  "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em]",
  "[&_pre]:bg-muted [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_hr]:my-4 [&_img]:max-w-full [&>*:first-child]:mt-0",
);

type MarkdownFieldProps<T extends FieldValues, N extends FieldPath<T>> = FieldBaseProps<T, N> & {
  rows?: number;
  placeholder?: string;
  /** Store "" as null. Default true (markdown columns are nullable). */
  nullable?: boolean;
};

/** Markdown textarea with a Write / Preview switch (GFM, sanitised like the public site). */
export function MarkdownField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  disabled,
  className,
  rows = 8,
  placeholder,
  nullable = true,
}: MarkdownFieldProps<T, N>) {
  const { id, inputRef, value: fieldValue, onChange, onBlur, error } = useBoundField(control, name);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const value = (fieldValue as string | null | undefined) ?? "";

  return (
    <FieldShell
      id={id}
      label={label}
      description={
        description ?? "Markdown: **bold**, _italic_, lists, [links](https://…), tables."
      }
      error={error}
      required={required}
      className={className}
      field={name}
    >
      <Tabs value={tab} onValueChange={(next) => setTab(next === "preview" ? "preview" : "write")}>
        <TabsList aria-label={`${label} editor mode`}>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        {/* forceMount keeps the textarea (and its ref for focus-on-error) in the DOM. */}
        <TabsContent value="write" forceMount hidden={tab !== "write"}>
          <Textarea
            id={id}
            ref={inputRef}
            name={name}
            value={value}
            rows={rows}
            onChange={(event) =>
              onChange(nullable && event.target.value === "" ? null : event.target.value)
            }
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, true, Boolean(error))}
            className="font-mono text-[13px]"
          />
        </TabsContent>
        <TabsContent value="preview">
          <div
            className={cn(
              "bg-background min-h-24 rounded-lg border px-3 py-2",
              markdownPreviewClass,
            )}
          >
            {value.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {value}
              </ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">Nothing to preview.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </FieldShell>
  );
}
