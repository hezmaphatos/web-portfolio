"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import {
  applyServerErrors,
  FormActions,
  FormErrorSummary,
  FormSection,
  MarkdownField,
  MediaField,
  NumberField,
  SelectField,
  SwitchField,
  TextField,
} from "@/components/admin/form";
import {
  awardSchema,
  EMPTY_AWARD,
  toAwardValues,
  type AwardFormOutput,
  type AwardFormValues,
} from "@/components/admin/awards/award-schema";
import { PLACEMENT_LABEL, PlacementBadge } from "@/components/admin/awards/PlacementBadge";
import { useSaveResource } from "@/lib/admin/resource";
import { AWARD_PLACEMENTS, type AdminAward } from "@/lib/types";

const PLACEMENT_OPTIONS = AWARD_PLACEMENTS.map((value) => ({
  value,
  label: PLACEMENT_LABEL[value],
}));

const ERROR_LABELS: Record<string, string> = {
  media_id: "Certificate image",
  url: "Link",
  is_visible: "Visible",
};

/** Create (row = null) and edit form for one award. Mount it with `key={row?.id ?? "new"}`. */
export function AwardForm({ row }: { row: AdminAward | null }) {
  const router = useRouter();
  const save = useSaveResource<AdminAward>("awards");
  const form = useForm<AwardFormValues, unknown, AwardFormOutput>({
    resolver: zodResolver(awardSchema),
    defaultValues: row ? toAwardValues(row) : EMPTY_AWARD,
  });
  const { control, reset } = form;
  const placement = useWatch({ control, name: "placement" });

  // Next keeps visited pages alive but hidden (Activity). If the row changes behind this form
  // (inline table toggle, a refetch), take the new values for every field the user has not
  // edited, so a later save never writes stale data back.
  useEffect(() => {
    if (row) reset(toAwardValues(row), { keepDirtyValues: true, keepErrors: true });
  }, [row, reset]);

  // After a create, the hidden /new page would still hold the created award: clear it once it is
  // hidden, so the next "Add award" starts empty. An unsaved draft is kept.
  const [created, setCreated] = useState(false);
  useLayoutEffect(() => {
    if (!created) return;
    return () => {
      setCreated(false);
      reset(EMPTY_AWARD);
    };
  }, [created, reset]);

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) =>
        save.mutate(
          { id: row?.id, values },
          {
            onSuccess: (saved) => {
              form.reset(toAwardValues(saved));
              if (!row) {
                setCreated(true);
                router.replace(`/admin/awards/${saved.id}`);
              }
            },
            onError: (error) => applyServerErrors(form, error),
          },
        ),
      )}
    >
      <FormErrorSummary control={control} labels={ERROR_LABELS} />

      <FormSection title="Award" columns={2}>
        <TextField
          control={control}
          name="title"
          label="Title"
          required
          maxLength={255}
          placeholder="Gold Medal — National Level, Informatics"
          className="sm:col-span-2"
        />
        <TextField
          control={control}
          name="event"
          label="Event"
          required
          maxLength={255}
          placeholder="Indonesian Student Olympiad (OPI)"
        />
        <TextField
          control={control}
          name="issuer"
          label="Issuer"
          nullable
          maxLength={255}
          placeholder="Organizing body"
        />
        <SelectField
          control={control}
          name="placement"
          label="Placement"
          required
          options={PLACEMENT_OPTIONS}
          description={
            <span className="inline-flex items-center gap-1.5">
              Shown as {placement ? <PlacementBadge placement={placement} /> : "—"}
            </span>
          }
        />
        <NumberField
          control={control}
          name="year"
          label="Year"
          min={1990}
          max={2100}
          step={1}
          placeholder="2025"
        />
        <TextField
          control={control}
          name="category"
          label="Category"
          nullable
          maxLength={60}
          placeholder="Olympiad, Contest, Hackathon…"
        />
      </FormSection>

      <FormSection title="Details" columns={2}>
        <MarkdownField
          control={control}
          name="description"
          label="Description"
          rows={4}
          className="sm:col-span-2"
        />
        <MediaField
          control={control}
          name="media_id"
          label="Certificate image"
          accept="image"
          initialMedia={row?.image}
          description="Optional. Shown when a visitor takes a closer look at the trophy."
        />
        <TextField
          control={control}
          name="url"
          label="Link"
          type="url"
          nullable
          maxLength={500}
          placeholder="https://…"
          description="Optional page about the award or the event."
        />
        <SwitchField
          control={control}
          name="is_visible"
          label="Visible on the site"
          description="Hidden awards stay here but are left out of the Trophy Room."
          className="sm:col-span-2"
        />
      </FormSection>

      <FormActions
        control={control}
        isPending={save.isPending}
        cancelHref="/admin/awards"
        submitLabel={row ? "Save changes" : "Create award"}
      />
    </form>
  );
}
