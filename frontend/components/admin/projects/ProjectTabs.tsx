"use client";

import { useId } from "react";
import { useController, useWatch, type UseFormSetValue } from "react-hook-form";
import { InfoIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import {
  ColorField,
  FieldError,
  FormSection,
  MarkdownField,
  MediaField,
  NumberField,
  SelectField,
  SlugField,
  StringListField,
  SwitchField,
  TextareaField,
  TextField,
  type AnyControl,
} from "@/components/admin/form";
import { BossPreview } from "@/components/admin/projects/BossPreview";
import { GalleryField } from "@/components/admin/projects/GalleryField";
import { TechSkillsField } from "@/components/admin/projects/TechSkillsField";
import {
  BOSS_HP_MAX,
  BOSS_HP_MIN,
  BOSS_TIER_LABEL,
  projectPath,
  type ProjectFormValues,
} from "@/components/admin/projects/project-form";
import {
  BOSS_TIERS,
  PROJECT_KINDS,
  PROJECT_PROGRESS,
  type AdminProject,
  type BossTier,
  type ProjectCategory,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type TabProps = {
  control: AnyControl<ProjectFormValues>;
  row: AdminProject | null;
};

const CATEGORY_OPTIONS: { value: ProjectCategory; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "ml", label: "Machine learning" },
  { value: "game", label: "Game" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

const TIERS = Object.keys(BOSS_TIERS) as BossTier[];

const TIER_HINT: Record<BossTier, string> = {
  minion: "A quick warm-up fight.",
  regular: "The standard project boss.",
  final: "3 visual phases (66 % / 33 %).",
};

/* ── Basic ────────────────────────────────────────────────────────────── */

export function BasicTab({ control }: TabProps) {
  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Project" columns={2}>
        <TextField
          control={control}
          name="title"
          label="Title"
          required
          maxLength={255}
          className="sm:col-span-2"
        />
        <SlugField
          control={control}
          name="slug"
          label="Slug"
          source="title"
          prefix="/projects/"
          className="sm:col-span-2"
        />
        <TextField
          control={control}
          name="tagline"
          label="Tagline"
          nullable
          maxLength={255}
          description="One line under the title on cards and the project page."
          className="sm:col-span-2"
        />
        <SelectField
          control={control}
          name="category"
          label="Category"
          options={CATEGORY_OPTIONS}
        />
        <SelectField control={control} name="kind" label="Kind" options={PROJECT_KINDS} />
        <SelectField
          control={control}
          name="progress"
          label="Progress"
          options={PROJECT_PROGRESS}
        />
        <SelectField
          control={control}
          name="status"
          label="Status"
          options={STATUS_OPTIONS}
          description="Drafts are hidden from the site; use Preview to see them."
        />
      </FormSection>

      <FormSection title="Details" columns={2}>
        <TextField
          control={control}
          name="role"
          label="My role"
          nullable
          maxLength={255}
          placeholder="e.g. Project Lead (team of 5)"
        />
        <NumberField control={control} name="team_size" label="Team size" min={1} max={255} />
        <NumberField control={control} name="year_start" label="Start year" min={1990} max={2100} />
        <NumberField
          control={control}
          name="year_end"
          label="End year"
          min={1990}
          max={2100}
          description="Leave empty while the project is ongoing."
        />
      </FormSection>

      <FormSection title="Showcase" columns={2}>
        <ColorField
          control={control}
          name="accent_color"
          label="Accent colour"
          required
          description="Tints the project page, its card and the generated boss."
        />
        <NumberField
          control={control}
          name="sort_order"
          label="Sort order"
          min={0}
          max={65535}
          description="Showcase position (0 = first). Empty adds it at the end; drag rows in the project list to reorder."
        />
        <SwitchField
          control={control}
          name="is_featured"
          label="Featured"
          description="Shown in the pinned showcase on the Home page."
          className="sm:col-span-2"
        />
      </FormSection>
    </div>
  );
}

/* ── Story ────────────────────────────────────────────────────────────── */

export function StoryTab({ control }: TabProps) {
  const status = useWatch({ control, name: "status" });
  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Overview">
        <TextareaField
          control={control}
          name="summary"
          label="Summary"
          required={status === "published"}
          nullable
          rows={3}
          maxLength={2000}
          description="Short overview for cards and the top of the page. Required to publish."
        />
      </FormSection>
      <FormSection title="Story blocks" description="Problem → Solution → Impact, in markdown.">
        <MarkdownField control={control} name="problem" label="Problem" rows={6} />
        <MarkdownField control={control} name="solution" label="Solution" rows={6} />
        <MarkdownField control={control} name="impact" label="Impact" rows={6} />
        <MarkdownField
          control={control}
          name="description"
          label="Description"
          rows={10}
          description="Longer write-up shown after the story blocks."
        />
      </FormSection>
      <FormSection title="Lists" columns={2}>
        <StringListField
          control={control}
          name="highlights"
          label="Highlights"
          itemLabel="Highlight"
          addLabel="Add highlight"
          maxItems={50}
        />
        <StringListField
          control={control}
          name="challenges"
          label="Challenges"
          itemLabel="Challenge"
          addLabel="Add challenge"
          maxItems={50}
        />
      </FormSection>
    </div>
  );
}

/* ── Tech ─────────────────────────────────────────────────────────────── */

export function TechTab({ control }: TabProps) {
  return (
    <FormSection
      title="Tech stack"
      description="Order = reveal order. The top chips are visible from the start; the rest stay locked until the visitor defeats the boss."
    >
      <TechSkillsField control={control} />
    </FormSection>
  );
}

/* ── Boss ─────────────────────────────────────────────────────────────── */

function BossTierField({
  control,
  setValue,
}: {
  control: AnyControl<ProjectFormValues>;
  setValue: UseFormSetValue<ProjectFormValues>;
}) {
  const {
    field: { value, onChange, onBlur, ref },
    fieldState: { error },
  } = useController({ control, name: "boss_tier" });
  const groupName = useId();

  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-2" data-field="boss_tier">
      <legend className="mb-1.5 text-sm leading-none font-medium">Tier</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <label
            key={tier}
            className={cn(
              "hover:bg-muted/50 flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm",
              "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-2",
              value === tier && "border-primary bg-muted/60 ring-primary ring-1",
            )}
          >
            <input
              ref={value === tier ? ref : undefined}
              type="radio"
              name={groupName}
              value={tier}
              checked={value === tier}
              onChange={() => {
                onChange(tier);
                // Choosing a tier applies its HP preset (still editable below).
                setValue("boss_hp", BOSS_TIERS[tier], { shouldDirty: true, shouldValidate: true });
              }}
              onBlur={onBlur}
              className="sr-only"
            />
            <span className="font-medium">{BOSS_TIER_LABEL[tier]}</span>
            <span className="text-muted-foreground text-xs">
              {BOSS_TIERS[tier]} HP preset · {TIER_HINT[tier]}
            </span>
          </label>
        ))}
      </div>
      <FieldError message={error?.message} />
    </fieldset>
  );
}

export function BossTab({
  control,
  row,
  setValue,
}: TabProps & { setValue: UseFormSetValue<ProjectFormValues> }) {
  const [enabled, tier, hp, title] = useWatch({
    control,
    name: ["boss_enabled", "boss_tier", "boss_hp", "title"],
  });
  const preset = BOSS_TIERS[tier];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
      <div className="flex flex-col gap-6">
        <FormSection title="Boss battle" columns={2}>
          <SwitchField
            control={control}
            name="boss_enabled"
            label="This project is a boss"
            description="Visitors fight it with their 4-skill loadout to unlock the rest of the tech stack, the links and the Live preview. Off = everything open, no Battle Arena."
            className="sm:col-span-2"
          />
          <BossTierField control={control} setValue={setValue} />
          <div className="flex flex-col gap-1.5">
            <NumberField
              control={control}
              name="boss_hp"
              label="Boss HP"
              required
              min={BOSS_HP_MIN}
              max={BOSS_HP_MAX}
              step={1}
              suffix="HP"
              description={`${BOSS_HP_MIN}–${BOSS_HP_MAX}. ${BOSS_TIER_LABEL[tier]} preset: ${preset}.`}
            />
            {hp !== preset ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="w-fit"
                onClick={() =>
                  setValue("boss_hp", preset, { shouldDirty: true, shouldValidate: true })
                }
              >
                <RotateCcwIcon aria-hidden />
                Use the {preset} HP preset
              </Button>
            ) : null}
          </div>
          <TextField
            control={control}
            name="boss_name"
            label="Boss name"
            nullable
            maxLength={80}
            placeholder={title || "Project title"}
            description="Empty = the project title."
          />
        </FormSection>

        <FormSection title="Look & lines" columns={2}>
          <MediaField
            control={control}
            name="boss_media_id"
            label="Boss sprite"
            accept="image"
            initialMedia={row?.boss_sprite}
            description="Optional. Empty = a generated pixel boss from the accent colour and tier (see the preview)."
            className="sm:col-span-2"
          />
          <TextareaField
            control={control}
            name="boss_intro"
            label="Intro line"
            nullable
            rows={2}
            maxLength={200}
            placeholder="A wild boss appears!"
            description="Shown when the visitor presses FIGHT!"
          />
          <TextareaField
            control={control}
            name="boss_defeat_text"
            label="Defeat line"
            nullable
            rows={2}
            maxLength={200}
            placeholder="Boss defeated."
            description="Shown under BOSS DEFEATED."
          />
        </FormSection>
        {!enabled ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <InfoIcon className="size-4 shrink-0" aria-hidden />
            The boss settings are kept but unused while the boss is off.
          </p>
        ) : null}
      </div>

      <div className="lg:sticky lg:top-4">
        <BossPreview control={control} initialSprite={row?.boss_sprite ?? null} />
      </div>
    </div>
  );
}

/* ── Media ────────────────────────────────────────────────────────────── */

export function MediaTab({ control, row }: TabProps) {
  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Cover">
        <MediaField
          control={control}
          name="cover_media_id"
          label="Cover image"
          accept="image"
          initialMedia={row?.cover}
          description="Used on cards and at the top of the page. A published project without a cover shows a generated placeholder."
        />
      </FormSection>

      <FormSection
        title="Gallery"
        description="Screenshots for the Preview Deck. Drag (or use the arrows) to reorder; each image is shown in its device frame."
      >
        <GalleryField control={control} />
      </FormSection>

      <FormSection title="Video" columns={2}>
        <TextField
          control={control}
          name="video_url"
          label="YouTube URL"
          type="url"
          nullable
          maxLength={500}
          placeholder="https://www.youtube.com/watch?v=…"
          description="Recommended: embedded lazily (youtube-nocookie), costs nothing until played."
        />
        <MediaField
          control={control}
          name="video_media_id"
          label="Uploaded video"
          accept="video"
          initialMedia={row?.video}
          description="MP4 or WebM, at most 30 MB. Also used as the short hover loop on project cards. YouTube is recommended for anything longer."
        />
      </FormSection>
    </div>
  );
}

/* ── Links & Preview ──────────────────────────────────────────────────── */

export function LinksTab({ control }: TabProps) {
  const [liveUrl, allowIframe] = useWatch({
    control,
    name: ["live_url", "allow_iframe_preview"],
  });
  return (
    <FormSection
      title="Links & live preview"
      description="Open site, Repo and the Live tab stay locked until the boss is defeated (a game mechanic, not security: the links are in the page data)."
      columns={2}
    >
      <TextField
        control={control}
        name="live_url"
        label="Live URL"
        type="url"
        nullable
        maxLength={500}
        placeholder="https://…"
      />
      <TextField
        control={control}
        name="repo_url"
        label="Repository URL"
        type="url"
        nullable
        maxLength={500}
        placeholder="https://github.com/…"
      />
      <SwitchField
        control={control}
        name="allow_iframe_preview"
        label="Allow the live preview (iframe)"
        description={
          <>
            Loads the live site inside a device frame on the Live tab. Many sites refuse to be
            framed (an <code>X-Frame-Options</code> header or a CSP <code>frame-ancestors</code>{" "}
            rule), so it stays off by default; blocked or slow sites fall back to a screenshot card
            with an “Open site” button. Turn it on only after checking the site allows framing.
          </>
        }
        className="sm:col-span-2"
      />
      {allowIframe && !liveUrl ? (
        <p className="flex items-center gap-2 text-sm text-amber-800 sm:col-span-2">
          <InfoIcon className="size-4 shrink-0" aria-hidden />
          Add a live URL, otherwise there is nothing to preview.
        </p>
      ) : null}
    </FormSection>
  );
}

/* ── SEO ──────────────────────────────────────────────────────────────── */

export function SeoTab({ control, row }: TabProps) {
  const [title, slug, summary, seoTitle, seoDescription] = useWatch({
    control,
    name: ["title", "slug", "summary", "seo_title", "seo_description"],
  });
  const shownTitle = seoTitle?.trim() || title?.trim() || "Project title";
  const shownDescription = seoDescription?.trim() || summary?.trim() || "";

  return (
    <div className="flex flex-col gap-6">
      <FormSection title="Search & sharing" columns={2}>
        <TextField
          control={control}
          name="seo_title"
          label="SEO title"
          nullable
          maxLength={255}
          placeholder={title || undefined}
          description="Empty = the project title."
          className="sm:col-span-2"
        />
        <TextareaField
          control={control}
          name="seo_description"
          label="SEO description"
          nullable
          rows={3}
          maxLength={300}
          placeholder={summary ?? undefined}
          description="Empty = the summary."
          className="sm:col-span-2"
        />
        <MediaField
          control={control}
          name="og_media_id"
          label="OG image"
          accept="image"
          initialMedia={row?.og_image}
          description="Optional image for link previews (1200×630 works best)."
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection title="Search result preview">
        <div className="flex flex-col gap-0.5" aria-label="Search result preview">
          <p className="text-muted-foreground truncate text-xs">
            {slug ? projectPath(slug) : "/projects/…"}
          </p>
          <p className="truncate text-base font-medium text-[#1a0dab]">{shownTitle}</p>
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {shownDescription || "No description yet."}
          </p>
        </div>
      </FormSection>
    </div>
  );
}
