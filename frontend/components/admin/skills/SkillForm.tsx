"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon } from "lucide-react";

import {
  applyServerErrors,
  FormActions,
  FormErrorSummary,
  FormSection,
  MediaField,
  SelectField,
  SlugField,
  SwitchField,
  TextareaField,
  TextField,
} from "@/components/admin/form";
import { DpsReadout } from "@/components/admin/skills/DpsReadout";
import { GameStatField } from "@/components/admin/skills/GameStatField";
import {
  CATEGORY_OPTIONS,
  COOLDOWN_MAX_MS,
  COOLDOWN_MIN_MS,
  COOLDOWN_STEP_MS,
  DAMAGE_MAX,
  DAMAGE_MIN,
  EMPTY_SKILL,
  LEVEL_OPTIONS,
  SKILL_FIELD_LABELS,
  skillSchema,
  SOFT,
  STATUS_OPTIONS,
  toFormValues,
  toPayload,
  type SkillFormInput,
  type SkillFormOutput,
} from "@/components/admin/skills/skill-schema";
import { firstErrors } from "@/lib/admin/api";
import { useSaveResource } from "@/lib/admin/resource";
import type { AdminSkill } from "@/lib/types";

const GAME_FIELDS = ["attack_name", "damage", "cooldown_ms"] as const;

/** An API error path that is one of this form's fields (SKILL_FIELD_LABELS lists all of them). */
function isSkillField(path: string): path is FieldPath<SkillFormInput> {
  return Object.hasOwn(SKILL_FIELD_LABELS, path);
}

type SkillFormProps = {
  /** null → create form. */
  row: AdminSkill | null;
};

/**
 * Create / edit a skill. Mount it once the row is loaded (`key={row?.id ?? "new"}`) so the
 * default values are ready at mount. Creating redirects to the edit page.
 */
export function SkillForm({ row }: SkillFormProps) {
  // Next keeps visited pages alive but hidden (Activity). After a create, the hidden /new page
  // would still hold the created skill, so it is remounted once hidden: the next "Add skill"
  // starts empty, slug auto-follow and icon preview included (a plain reset() keeps those).
  const [generation, setGeneration] = useState(0);
  const renew = useCallback(() => setGeneration((value) => value + 1), []);
  return <SkillFormBody key={generation} row={row} onCreatedAndHidden={renew} />;
}

function SkillFormBody({
  row,
  onCreatedAndHidden,
}: SkillFormProps & { onCreatedAndHidden: () => void }) {
  const router = useRouter();
  const save = useSaveResource<AdminSkill>("skills");
  const form = useForm<SkillFormInput, unknown, SkillFormOutput>({
    resolver: zodResolver(skillSchema),
    defaultValues: row ? toFormValues(row) : EMPTY_SKILL,
  });
  const { control, reset } = form;
  const category = useWatch({ control, name: "category" });
  const soft = category === SOFT;
  const hadGameData = row !== null && row.category !== SOFT && row.damage !== null;

  // If the row changes behind a kept-alive edit form (inline table toggle, a refetch), take the
  // new values for every field the user has not edited, so a later save never writes stale data.
  useEffect(() => {
    if (!row) return;
    reset(toFormValues(row), {
      keepDirtyValues: true,
      keepErrors: true,
      keepTouched: true,
      keepIsSubmitted: true,
      keepSubmitCount: true,
    });
  }, [row, reset]);

  // Runs its cleanup when Activity hides the /new page after a successful create (or unmounts it).
  const [created, setCreated] = useState(false);
  useLayoutEffect(() => {
    if (!created) return;
    return onCreatedAndHidden;
  }, [created, onCreatedAndHidden]);

  // The game fields are only checked outside "soft": after a submit, re-check them when the
  // category changes so a hidden field never keeps a stale error (and a shown one gets its own).
  useEffect(() => {
    if (form.formState.isSubmitted) void form.trigger(GAME_FIELDS);
  }, [category, form]);

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={form.handleSubmit((values) =>
        save.mutate(
          { id: row?.id, values: toPayload(values) },
          {
            onSuccess: (saved) => {
              form.reset(toFormValues(saved));
              if (!row) {
                setCreated(true);
                router.replace(`/admin/skills/${saved.id}`);
              }
            },
            onError: (error) => {
              // The kit's focus step looks fields up document-wide, so it can hit the hidden
              // copy of this form that Next keeps alive (Activity) and give up. setFocus() uses
              // this form's own field refs instead.
              if (!applyServerErrors(form, error, { focus: false })) return;
              const first = Object.keys(firstErrors(error)).find(isSkillField);
              if (first) requestAnimationFrame(() => form.setFocus(first));
            },
          },
        ),
      )}
    >
      <FormErrorSummary control={control} labels={SKILL_FIELD_LABELS} />

      <FormSection title="Skill" columns={2}>
        <TextField control={control} name="name" label="Name" required maxLength={80} />
        <SlugField
          control={control}
          name="slug"
          label="Slug"
          source="name"
          prefix="?skill="
          description="Used in project filter links. Lowercase letters, numbers and dashes; leave empty to generate it from the name."
        />
        <SelectField
          control={control}
          name="category"
          label="Category"
          required
          options={CATEGORY_OPTIONS}
        />
        <SelectField
          control={control}
          name="level"
          label="Level"
          required
          numeric
          options={LEVEL_OPTIONS}
          description="1–5. Higher levels usually hit harder and recharge slower."
        />
        <SelectField
          control={control}
          name="status"
          label="Status"
          required
          options={STATUS_OPTIONS}
          description="Core = used regularly; Learning = still picking it up."
        />
        <SwitchField
          control={control}
          name="is_visible"
          label="Visible on the site"
          description="Hidden skills are left out of the public site, project tech stacks included."
          className="sm:self-center"
        />
        <TextareaField
          control={control}
          name="description"
          label="Description"
          nullable
          rows={3}
          maxLength={5000}
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection
        title="Icon"
        description="Pick a built-in icon by key, upload one, or both: an uploaded icon is shown instead of the key."
        columns={2}
      >
        <TextField
          control={control}
          name="icon_key"
          label="Icon key"
          nullable
          maxLength={50}
          placeholder="e.g. laravel"
          description="Lowercase brand name, e.g. laravel, react, mysql."
          inputClassName="font-mono"
        />
        <MediaField
          control={control}
          name="icon_media_id"
          label="Icon image"
          accept="image"
          initialMedia={row?.icon}
          description="Square PNG or WebP works best (SVG is not accepted)."
        />
      </FormSection>

      <FormSection
        title="Game"
        description={
          soft
            ? undefined
            : "How this skill fights in the Skill Tree loadout and boss battles. Damage is fixed: no randomness, no critical hits."
        }
        columns={2}
      >
        {soft ? (
          <div className="bg-muted/40 flex gap-3 rounded-lg border p-4 text-sm sm:col-span-2">
            <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="font-medium">Soft skills are not game skills.</p>
              <p className="text-muted-foreground">
                They appear as chips in the About chapter only: no attack, damage or cooldown, and
                they can never be equipped in the loadout.
                {hadGameData
                  ? " Saving this skill as a soft skill clears its attack name, damage and cooldown."
                  : null}
              </p>
            </div>
          </div>
        ) : (
          <>
            <TextField
              control={control}
              name="attack_name"
              label="Attack name"
              required
              maxLength={60}
              placeholder="e.g. Eloquent Slam"
              description="Shown when the skill fires: “Eloquent Slam hits for 70”."
              className="sm:col-span-2"
            />
            <GameStatField
              control={control}
              name="damage"
              label="Damage"
              required
              min={DAMAGE_MIN}
              max={DAMAGE_MAX}
              step={1}
              unitLabel="damage"
              description={`Whole number, ${DAMAGE_MIN}–${DAMAGE_MAX}.`}
            />
            <GameStatField
              control={control}
              name="cooldown_ms"
              label="Cooldown"
              required
              min={COOLDOWN_MIN_MS / 1000}
              max={COOLDOWN_MAX_MS / 1000}
              step={COOLDOWN_STEP_MS / 1000}
              scale={1000}
              suffix="s"
              unitLabel="seconds"
              description="Seconds between shots: 1 to 4 in steps of 0.5."
            />
            <DpsReadout control={control} className="sm:col-span-2" />
          </>
        )}
      </FormSection>

      <FormActions
        control={control}
        isPending={save.isPending}
        cancelHref="/admin/skills"
        submitLabel={row ? "Save" : "Create skill"}
        requireDirty={row !== null}
      />
    </form>
  );
}
