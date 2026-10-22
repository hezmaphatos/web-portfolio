"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import {
  applyServerErrors,
  FormActions,
  FormErrorSummary,
  FormSection,
  MarkdownField,
  MediaField,
  RepeaterField,
  StringListField,
  SwitchField,
  TextareaField,
  TextField,
} from "@/components/admin/form";
import { siteQueryOptions, useSaveSite } from "@/components/admin/site/site-queries";
import {
  NEW_SOCIAL,
  NEW_STAT,
  SITE_FIELD_LABELS,
  SITE_LIMITS,
  siteSchema,
  toSiteValues,
  type SiteInput,
  type SiteOutput,
} from "@/components/admin/site/site-schema";
import { StatItemFields } from "@/components/admin/site/StatItemFields";
import { TechPercentField } from "@/components/admin/site/TechPercentField";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import type { AdminSite } from "@/lib/types";

/** In-page jump links; ids are on the wrappers below. */
const PARTS = [
  { id: "site-identity", label: "Identity" },
  { id: "site-bio", label: "Bio" },
  { id: "site-contact", label: "Contact & links" },
  { id: "site-stats", label: "Stats" },
  { id: "site-media", label: "Images & CV" },
  { id: "site-seo", label: "SEO" },
  { id: "site-game", label: "Game & sound" },
] as const;

/** GET /admin/site → the settings form (loading / error states included). */
export function SiteEditor() {
  const site = useQuery(siteQueryOptions);

  if (site.isPending) {
    return <LoadingState variant="form" rows={8} label="Loading profile & site settings…" />;
  }
  if (site.isError) {
    return (
      <ErrorState
        title="Could not load the site settings"
        error={site.error}
        onRetry={() => void site.refetch()}
        retrying={site.isFetching}
      />
    );
  }
  // Keyed by id only: a background refetch never resets what is being typed.
  return <SiteForm key={site.data.id} site={site.data} />;
}

function SiteForm({ site }: { site: AdminSite }) {
  const save = useSaveSite();
  const form = useForm<SiteInput, unknown, SiteOutput>({
    resolver: zodResolver(siteSchema),
    defaultValues: toSiteValues(site),
  });
  const { control } = form;

  return (
    <form
      noValidate
      className="flex max-w-4xl flex-col gap-6"
      onSubmit={form.handleSubmit((values) =>
        save.mutate(values, {
          onSuccess: (saved) => form.reset(toSiteValues(saved)),
          onError: (error) => applyServerErrors(form, error),
        }),
      )}
    >
      <nav aria-label="Form sections" className="-mt-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {PARTS.map((part) => (
            <li key={part.id}>
              <a
                href={`#${part.id}`}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded underline-offset-2 outline-none hover:underline focus-visible:ring-2"
              >
                {part.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <FormErrorSummary control={control} labels={SITE_FIELD_LABELS} />

      <div id="site-identity" className="scroll-mt-20">
        <FormSection
          title="Identity"
          description="Hero chapter: the big name, the player name and the rotating roles."
          columns={2}
        >
          <TextField
            control={control}
            name="full_name"
            label="Full name"
            required
            maxLength={255}
            autoComplete="off"
          />
          <TextField
            control={control}
            name="nickname"
            label="Nickname"
            required
            maxLength={60}
            autoComplete="off"
            description="The player name in the HUD (PLAYER: …)."
          />
          <TextField
            control={control}
            name="headline"
            label="Headline"
            nullable
            maxLength={255}
            className="sm:col-span-2"
          />
          <TextField
            control={control}
            name="tagline"
            label="Tagline"
            nullable
            maxLength={255}
            className="sm:col-span-2"
          />
          <StringListField
            control={control}
            name="roles"
            label="Roles"
            itemLabel="Role"
            addLabel="Add role"
            placeholder="Backend Developer"
            maxItems={SITE_LIMITS.roles}
            emptyText="No roles yet."
            description="Rotated in the hero, top to bottom. Enter in a role adds the next one."
            className="sm:col-span-2"
          />
        </FormSection>
      </div>

      <div id="site-bio" className="scroll-mt-20">
        <FormSection title="Bio" description="About chapter (CHARACTER SELECT).">
          <TextareaField
            control={control}
            name="short_bio"
            label="Short bio"
            rows={4}
            nullable
            maxLength={SITE_LIMITS.shortBio}
            description="Plain text; revealed word by word as the visitor scrolls."
          />
          <MarkdownField
            control={control}
            name="long_bio"
            label="Long bio"
            rows={10}
            description={`Optional longer story. Markdown, up to ${SITE_LIMITS.longBio.toLocaleString("en-US")} characters.`}
          />
        </FormSection>
      </div>

      <div id="site-contact" className="scroll-mt-20">
        <FormSection
          title="Contact & links"
          description="Final stage (contact chapter) and footer."
          columns={2}
        >
          <TextField
            control={control}
            name="location"
            label="Location"
            nullable
            maxLength={255}
            placeholder="Tangerang Selatan, Indonesia"
          />
          <TextField
            control={control}
            name="email"
            label="Email"
            type="email"
            nullable
            maxLength={255}
            autoComplete="off"
            description="Public: shown with a copy button."
          />
          <TextField
            control={control}
            name="phone"
            label="Phone"
            type="tel"
            nullable
            maxLength={50}
            autoComplete="off"
            description="Stays hidden on the public site unless “Show phone publicly” is on."
          />
          <SwitchField
            control={control}
            name="show_phone"
            label="Show phone publicly"
            description="Off by default: the number is stored here only and never sent to the site."
            className="sm:self-center"
          />
          <RepeaterField
            control={control}
            name="socials"
            label="Social links"
            itemLabel="Link"
            addLabel="Add link"
            maxItems={SITE_LIMITS.socials}
            emptyText="No social links yet."
            description="Shown in the contact chapter, in this order."
            newItem={NEW_SOCIAL}
            itemTitle={(index, item) => item.label || `Link ${index + 1}`}
            itemClassName="sm:grid-cols-4"
            className="sm:col-span-2"
            renderItem={({ name }) => (
              <>
                <TextField
                  control={control}
                  name={`${name}.label`}
                  label="Label"
                  required
                  maxLength={60}
                  placeholder="GitHub"
                />
                <TextField
                  control={control}
                  name={`${name}.url`}
                  label="URL"
                  type="url"
                  required
                  maxLength={500}
                  placeholder="https://github.com/…"
                  className="sm:col-span-2"
                />
                <TextField
                  control={control}
                  name={`${name}.icon`}
                  label="Icon"
                  nullable
                  maxLength={40}
                  placeholder="github"
                  description="Key, e.g. github, linkedin, instagram, youtube, x."
                />
              </>
            )}
          />
        </FormSection>
      </div>

      <div id="site-stats" className="scroll-mt-20">
        <FormSection
          title="Stats"
          description="Stat cards with animated counters in the About chapter."
        >
          <RepeaterField
            control={control}
            name="stats"
            label="Stat cards"
            itemLabel="Stat"
            addLabel="Add stat"
            maxItems={SITE_LIMITS.stats}
            emptyText="No stats yet."
            description="Set “Auto value” to show the live published-project count instead of a fixed value."
            newItem={NEW_STAT}
            itemTitle={(index, item) => item.label || `Stat ${index + 1}`}
            itemClassName="sm:grid-cols-4"
            renderItem={({ name }) => <StatItemFields control={control} name={name} />}
          />
        </FormSection>
      </div>

      <div id="site-media" className="scroll-mt-20">
        <FormSection
          title="Images & CV"
          description="Picked from the Media Library. Empty images fall back to a generated placeholder."
          columns={2}
        >
          <MediaField
            control={control}
            name="portrait_media_id"
            label="Portrait photo"
            accept="image"
            initialMedia={site.portrait}
            description="Front of the flip card in the About chapter."
          />
          <MediaField
            control={control}
            name="avatar_media_id"
            label="Pixel avatar"
            accept="image"
            initialMedia={site.avatar}
            description="Back of the flip card. A square image works best."
          />
          <MediaField
            control={control}
            name="cv_media_id"
            label="CV"
            accept="pdf"
            initialMedia={site.cv}
            description="PDF behind the Download CV button in the About chapter."
            className="sm:col-span-2"
          />
        </FormSection>
      </div>

      <div id="site-seo" className="scroll-mt-20">
        <FormSection
          title="SEO defaults"
          description="Used by the home page and by any page without its own SEO fields."
        >
          <TextField
            control={control}
            name="seo_title"
            label="SEO title"
            nullable
            maxLength={255}
            description="Browser tab and search result title. Around 60 characters reads best."
          />
          <TextareaField
            control={control}
            name="seo_description"
            label="SEO description"
            rows={3}
            nullable
            maxLength={SITE_LIMITS.seoDescription}
            description="Search result snippet. Around 150–160 characters reads best."
          />
          <MediaField
            control={control}
            name="og_media_id"
            label="Social share image (OG)"
            accept="image"
            initialMedia={site.og_image}
            description="Preview image for links shared on social media; 1200×630 is ideal."
          />
        </FormSection>
      </div>

      <div id="site-game" className="scroll-mt-20">
        <FormSection title="Game & sound">
          <TechPercentField
            control={control}
            name="tech_visible_percent"
            label="Visible tech before a boss is defeated"
            description="Share of each boss project's tech stack that is open from the start; the rest shows as locked “???” chips until the visitor wins the battle."
          />
          <SwitchField
            control={control}
            name="sound_default"
            label="Sound on by default"
            description="Whether the Web Audio sound effects start on for new visitors. Visitors can always toggle sound in the HUD, and their choice is remembered in their browser."
          />
        </FormSection>
      </div>

      <FormActions
        control={control}
        isPending={save.isPending}
        onCancel={() => form.reset(toSiteValues(site))}
        cancelLabel="Discard changes"
      />
    </form>
  );
}
