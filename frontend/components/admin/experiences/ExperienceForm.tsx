"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  useFormState,
  useWatch,
  type Control,
  type UseFormTrigger,
} from "react-hook-form";

import {
  applyServerErrors,
  CheckboxField,
  DateField,
  FormActions,
  FormErrorSummary,
  FormSection,
  MarkdownField,
  MediaField,
  NumberField,
  RepeaterField,
  SelectField,
  StringListField,
  SwitchField,
  TextField,
} from "@/components/admin/form";
import {
  EMPTY_EXPERIENCE,
  EXPERIENCE_TYPE_LABEL,
  experienceSchema,
  formatPeriod,
  MAX_BULLETS,
  MAX_METRICS,
  toExperiencePayload,
  toExperienceValues,
  type ExperienceFormOutput,
  type ExperienceFormValues,
} from "@/components/admin/experiences/experience-schema";
import { useSaveResource } from "@/lib/admin/resource";
import { EXPERIENCE_TYPES, type AdminExperience } from "@/lib/types";

type FormControl = Control<ExperienceFormValues, unknown, ExperienceFormOutput>;

const TYPE_OPTIONS = EXPERIENCE_TYPES.map((type) => ({
  value: type,
  label: EXPERIENCE_TYPE_LABEL[type],
}));

const ERROR_LABELS: Record<string, string> = {
  type: "Type",
  start_date: "Start date",
  end_date: "End date",
  logo_media_id: "Logo",
  bullets: "Bullets",
  metrics: "Metrics",
  is_visible: "Visible",
};

const numberFormat = new Intl.NumberFormat("en");

/** Create (row = null) and edit form for one experience. Mount it with `key={row?.id ?? "new"}`. */
export function ExperienceForm({ row }: { row: AdminExperience | null }) {
  const router = useRouter();
  const save = useSaveResource<AdminExperience>("experiences");
  const form = useForm<ExperienceFormValues, unknown, ExperienceFormOutput>({
    resolver: zodResolver(experienceSchema),
    defaultValues: row ? toExperienceValues(row) : EMPTY_EXPERIENCE,
  });
  const { control, reset } = form;

  // Next keeps visited pages alive but hidden (Activity). If the row changes behind this form
  // (inline table toggle, a refetch), take the new values for every field the user has not
  // edited, so a later save never writes stale data back.
  useEffect(() => {
    if (row) reset(toExperienceValues(row), { keepDirtyValues: true, keepErrors: true });
  }, [row, reset]);

  // After a create, the hidden /new page would still hold the created entry: clear it once it is
  // hidden, so the next "Add experience" starts empty. An unsaved draft is kept.
  const [created, setCreated] = useState(false);
  useLayoutEffect(() => {
    if (!created) return;
    return () => {
      setCreated(false);
      reset(EMPTY_EXPERIENCE);
    };
  }, [created, reset]);

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) =>
        save.mutate(
          { id: row?.id, values: toExperiencePayload(values) },
          {
            onSuccess: (saved) => {
              form.reset(toExperienceValues(saved));
              if (!row) {
                setCreated(true);
                router.replace(`/admin/experiences/${saved.id}`);
              }
            },
            onError: (error) => applyServerErrors(form, error),
          },
        ),
      )}
    >
      <FormErrorSummary control={control} labels={ERROR_LABELS} />

      <FormSection title="Role" columns={2}>
        <TextField
          control={control}
          name="title"
          label="Title"
          required
          maxLength={255}
          placeholder="Software Developer Intern"
        />
        <TextField
          control={control}
          name="organization"
          label="Organization"
          required
          maxLength={255}
          placeholder="Unggul Mitra Solusi"
        />
        <SelectField
          control={control}
          name="type"
          label="Type"
          options={TYPE_OPTIONS}
          required
          description="Groups the entry on the Quest Log tabs."
        />
        <TextField
          control={control}
          name="location"
          label="Location"
          nullable
          maxLength={255}
          placeholder="Jakarta Barat"
        />
        <TextField
          control={control}
          name="subtitle"
          label="Subtitle"
          nullable
          maxLength={255}
          placeholder="GPA 3.91/4.00"
          description="A short line under the title, e.g. a grade or a team name."
          className="sm:col-span-2"
        />
      </FormSection>

      <PeriodSection control={control} trigger={form.trigger} />

      <FormSection
        title="Story"
        description="What you did there. Bullets show as a list; metrics show as counters."
      >
        <MarkdownField control={control} name="description" label="Description" rows={5} />
        <StringListField
          control={control}
          name="bullets"
          label="Bullets"
          itemLabel="Bullet"
          addLabel="Add bullet"
          placeholder="Built …"
          maxItems={MAX_BULLETS}
          emptyText="No bullets yet."
          description="Press Enter in a bullet to add the next one."
        />
        <RepeaterField
          control={control}
          name="metrics"
          label="Metrics"
          itemLabel="Metric"
          addLabel="Add metric"
          maxItems={MAX_METRICS}
          emptyText="No metrics yet."
          description="Numbers worth bragging about, e.g. “50+ full enrollments”."
          newItem={() => ({ label: "", value: null, prefix: null, suffix: null })}
          itemClassName="sm:grid-cols-[6rem_minmax(0,10rem)_6rem_minmax(0,1fr)]"
          renderItem={({ name }) => (
            <>
              <TextField
                control={control}
                name={`${name}.prefix`}
                label="Prefix"
                nullable
                maxLength={20}
                placeholder="~"
              />
              <NumberField
                control={control}
                name={`${name}.value`}
                label="Value"
                required
                step="any"
                placeholder="50"
              />
              <TextField
                control={control}
                name={`${name}.suffix`}
                label="Suffix"
                nullable
                maxLength={20}
                placeholder="+"
              />
              <TextField
                control={control}
                name={`${name}.label`}
                label="Label"
                required
                maxLength={100}
                placeholder="full enrollments"
              />
              <MetricPreview control={control} name={name} />
            </>
          )}
        />
      </FormSection>

      <FormSection title="Display" columns={2}>
        <MediaField
          control={control}
          name="logo_media_id"
          label="Logo"
          accept="image"
          initialMedia={row?.logo}
          description="Optional. Without a logo the site shows a placeholder."
        />
        <SwitchField
          control={control}
          name="is_visible"
          label="Visible on the site"
          description="Hidden entries stay here but are left out of the Quest Log."
          className="sm:pt-6"
        />
      </FormSection>

      <FormActions
        control={control}
        isPending={save.isPending}
        cancelHref="/admin/experiences"
        submitLabel={row ? "Save changes" : "Create experience"}
      />
    </form>
  );
}

/* ── Period: start, end and the "Present" switch ──────────────────────── */

function PeriodSection({
  control,
  trigger,
}: {
  control: FormControl;
  trigger: UseFormTrigger<ExperienceFormValues>;
}) {
  const present = useWatch({ control, name: "present" });
  const start = useWatch({ control, name: "start_date" });
  const end = useWatch({ control, name: "end_date" });
  const { isSubmitted } = useFormState({ control });

  // After a failed submit, re-check the end date when the inputs it depends on change (the
  // resolver only refreshes the error of the field being edited).
  useEffect(() => {
    if (isSubmitted) void trigger("end_date");
  }, [present, start, isSubmitted, trigger]);

  return (
    <FormSection
      title="Period"
      columns={2}
      description={
        <>
          Shows as{" "}
          <span className="text-foreground font-medium">
            {formatPeriod(start, present ? null : end)}
          </span>
          . The site only shows month and year.
        </>
      }
    >
      <DateField control={control} name="start_date" label="Start date" required />
      {present ? (
        <div className="flex flex-col gap-1.5" data-field="end_date">
          <span className="text-sm leading-none font-medium">End date</span>
          <p className="text-muted-foreground bg-muted/50 flex h-8 w-44 items-center rounded-md border border-dashed px-2.5 text-sm">
            Present
          </p>
        </div>
      ) : (
        <DateField
          control={control}
          name="end_date"
          label="End date"
          required
          min={start ?? undefined}
        />
      )}
      <CheckboxField
        control={control}
        name="present"
        label="I still do this (Present)"
        description="No end date: the period ends with “Present”."
        className="sm:col-span-2"
      />
    </FormSection>
  );
}

/* ── Metric preview ───────────────────────────────────────────────────── */

function MetricPreview({ control, name }: { control: FormControl; name: `metrics.${number}` }) {
  const metric = useWatch({ control, name });
  const value =
    typeof metric?.value === "number" && Number.isFinite(metric.value)
      ? numberFormat.format(metric.value)
      : "?";

  return (
    <p className="text-muted-foreground text-xs sm:col-span-4" aria-live="off">
      Shows as{" "}
      <span className="text-foreground font-semibold tabular-nums">
        {metric?.prefix ?? ""}
        {value}
        {metric?.suffix ?? ""}
      </span>{" "}
      {metric?.label || "label"}
    </p>
  );
}
