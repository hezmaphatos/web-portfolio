"use client";

import { Fragment } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { CircleHelpIcon, SearchXIcon } from "lucide-react";
import { z } from "zod";

import {
  applyServerErrors,
  FormActions,
  FormErrorSummary,
  FormSection,
  MarkdownField,
  SwitchField,
  TextareaField,
  TextField,
  type AnyControl,
} from "@/components/admin/form";
import { BODY_MAX, chapterInfo, HINT_MAX } from "@/components/admin/sections/chapters";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/admin/ui/button";
import { ApiError } from "@/lib/admin/api";
import { useResourceItem, useSaveResource } from "@/lib/admin/resource";
import type { AdminSection } from "@/lib/types";

const tooLong = (max: number) => `Use at most ${max.toLocaleString("en-US")} characters.`;

/** Mirrors UpdateSectionRequest. `key` and `sort_order` are fixed and never sent. */
const schema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(255, tooLong(255)),
  subtitle: z.string().max(255, tooLong(255)).nullable(),
  body: z.string().max(BODY_MAX, tooLong(BODY_MAX)).nullable(),
  hint: z.string().max(HINT_MAX, tooLong(HINT_MAX)).nullable(),
  is_visible: z.boolean(),
});

type SectionInput = z.input<typeof schema>;
type SectionOutput = z.output<typeof schema>;

function toValues(row: AdminSection): SectionInput {
  return {
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    hint: row.hint,
    is_visible: row.is_visible,
  };
}

const BACK = { href: "/admin/sections", label: "Sections" };

/** `rawId` is the `[id]` route segment, as typed in the URL. */
export function SectionEditor({ rawId }: { rawId: string }) {
  const id = /^[1-9]\d{0,9}$/.test(rawId) ? Number(rawId) : null;
  const item = useResourceItem<AdminSection>("sections", id);
  const notFound = id === null || (item.error instanceof ApiError && item.error.status === 404);

  if (notFound) {
    return (
      <>
        <PageHeader title="Section not found" back={BACK} />
        <EmptyState
          icon={SearchXIcon}
          title="This section does not exist"
          description="There are exactly eight chapters; pick one from the list."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/sections">Back to sections</Link>
            </Button>
          }
        />
      </>
    );
  }

  if (item.isPending) {
    return (
      <>
        <PageHeader title="Edit section" back={BACK} />
        <LoadingState variant="form" rows={4} label="Loading section…" />
      </>
    );
  }

  if (item.isError) {
    return (
      <>
        <PageHeader title="Edit section" back={BACK} />
        <ErrorState
          title="Could not load the section"
          error={item.error}
          onRetry={() => void item.refetch()}
          retrying={item.isFetching}
        />
      </>
    );
  }

  const row = item.data;
  const info = chapterInfo(row.key);

  return (
    <>
      <PageHeader
        title={`Edit ${row.title}`}
        back={BACK}
        description={
          <>
            Chapter {row.sort_order} ·{" "}
            <code className="bg-muted rounded px-1 font-mono text-xs">{row.key}</code>
            {info ? (
              <>
                {" "}
                · {info.summary} Content:{" "}
                {info.sources.map((source, index) => (
                  <Fragment key={source.href}>
                    {index > 0 ? ", " : null}
                    <Link
                      href={source.href}
                      className="text-foreground underline underline-offset-2 hover:no-underline"
                    >
                      {source.label}
                    </Link>
                  </Fragment>
                ))}
                .
              </>
            ) : null}
          </>
        }
      />
      <SectionForm key={row.id} row={row} />
    </>
  );
}

function SectionForm({ row }: { row: AdminSection }) {
  const save = useSaveResource<AdminSection>("sections");
  const form = useForm<SectionInput, unknown, SectionOutput>({
    resolver: zodResolver(schema),
    defaultValues: toValues(row),
  });
  const { control } = form;

  return (
    <form
      noValidate
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={form.handleSubmit((values) =>
        save.mutate(
          { id: row.id, values },
          {
            onSuccess: (saved) => form.reset(toValues(saved)),
            onError: (error) => applyServerErrors(form, error),
          },
        ),
      )}
    >
      <FormErrorSummary control={control} labels={{ is_visible: "Visible" }} />

      <FormSection
        title="Chapter text"
        description="The heading block of this chapter on the home page."
      >
        <TextField control={control} name="title" label="Title" required maxLength={255} />
        <TextField
          control={control}
          name="subtitle"
          label="Subtitle"
          nullable
          maxLength={255}
          description="Optional line under the title."
        />
        <MarkdownField
          control={control}
          name="body"
          label="Intro text"
          rows={6}
          description={`Optional short introduction shown under the heading. Markdown, up to ${BODY_MAX.toLocaleString("en-US")} characters.`}
        />
      </FormSection>

      <FormSection
        title="Stage hint"
        description="The tutorial card for this chapter: it pops up once when a visitor reaches the chapter, closes after a few seconds, and the Help (?) button shows it again."
      >
        <TextareaField
          control={control}
          name="hint"
          label="Hint text"
          rows={3}
          nullable
          maxLength={HINT_MAX}
          description="One or two short sentences that tell the visitor what to do here, e.g. “Use the tabs to filter. Tap an entry to expand it.”"
        />
        <HintPreview control={control} />
      </FormSection>

      <FormSection title="Visibility">
        <SwitchField
          control={control}
          name="is_visible"
          label="Show this chapter on the home page"
          description={
            row.key === "boot"
              ? "When off, visitors skip the splash screen and land on the hero."
              : "When off, the chapter is left out of the home page and the chapter menu."
          }
        />
      </FormSection>

      <FormActions control={control} isPending={save.isPending} cancelHref="/admin/sections" />
    </form>
  );
}

/** Rough sentence count, only for the "one or two sentences" nudge (spec §5.3). */
function countSentences(text: string): number {
  return text.split(/[.!?]+(?:\s+|$)/).filter((part) => part.trim() !== "").length;
}

/** Live look at the hint card (plain text, like the public `<StageHint>`). */
function HintPreview({ control }: { control: AnyControl<SectionInput> }) {
  const hint = useWatch({ control, name: "hint" });
  const text = hint?.trim() ?? "";
  const sentences = text ? countSentences(text) : 0;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Preview
      </figcaption>
      {text ? (
        <div className="flex max-w-[320px] items-start gap-3 rounded-md border-2 border-neutral-900 bg-[#F3EFE6] p-3 text-sm text-neutral-900 shadow-[4px_4px_0_#111]">
          <CircleHelpIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="wrap-break-word">{text}</p>
        </div>
      ) : (
        <p className="text-sm text-amber-800">
          No hint: every chapter should tell visitors what to do (spec §5.3).
        </p>
      )}
      {sentences > 2 ? (
        <p className="text-xs text-amber-800">
          This hint has {sentences} sentences; one or two read best in the small card.
        </p>
      ) : null}
    </figure>
  );
}
