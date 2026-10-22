"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFormState, type FieldErrors, type UseFormReturn } from "react-hook-form";
import { ExternalLinkIcon, EyeIcon, Loader2Icon, SaveIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/admin/ui/alert-dialog";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import {
  applyServerErrors,
  flattenErrors,
  focusField,
  FormActions,
  FormErrorSummary,
  type AnyControl,
} from "@/components/admin/form";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import {
  BasicTab,
  BossTab,
  LinksTab,
  MediaTab,
  SeoTab,
  StoryTab,
  TechTab,
} from "@/components/admin/projects/ProjectTabs";
import {
  EMPTY_PROJECT,
  firstTabWithError,
  PROJECT_FIELD_LABELS,
  PROJECT_TAB_IDS,
  PROJECT_TABS,
  previewHref,
  projectPath,
  projectSchema,
  tabOf,
  toPayload,
  toValues,
  type ProjectFormOutput,
  type ProjectFormValues,
  type ProjectTab,
} from "@/components/admin/projects/project-form";
import { useHashTab } from "@/components/admin/projects/use-hash-tab";
import { firstErrors } from "@/lib/admin/api";
import { useDeleteResource, useSaveResource } from "@/lib/admin/resource";
import type { AdminProject } from "@/lib/types";

type ProjectFormApi = UseFormReturn<ProjectFormValues, unknown, ProjectFormOutput>;

type ProjectFormProps = {
  /** The saved project (edit) or null (create). Mount with `key={row?.id ?? "new"}`. */
  row: AdminProject | null;
  /** Create only: called after the project was created, right before the redirect to its page. */
  onCreated?: (saved: AdminProject) => void;
};

/**
 * Project create/edit form (spec §7 "Form Project"), split into tabs kept in the URL hash.
 * Every tab stays mounted (inactive ones are hidden) so local field state survives tab switches;
 * after a failed save the first tab with an error opens and its first field is focused.
 */
export function ProjectForm({ row, onCreated }: ProjectFormProps) {
  const router = useRouter();
  const formId = useId();
  const save = useSaveResource<AdminProject>("projects");
  const [tab, setTab] = useHashTab<ProjectTab>(PROJECT_TAB_IDS, "basic");

  const form = useForm<ProjectFormValues, unknown, ProjectFormOutput>({
    resolver: zodResolver(projectSchema),
    defaultValues: row ? toValues(row) : EMPTY_PROJECT,
    // Focus is handled by revealErrors (the field may sit on a hidden tab).
    shouldFocusError: false,
  });
  const { control, setValue } = form;

  useUnsavedChangesWarning(control);
  useFollowSavedRow(form, row);

  function revealErrors(paths: string[]) {
    const target = firstTabWithError(paths);
    if (!target) return;
    setTab(target);
    const path = paths.find((candidate) => tabOf(candidate) === target);
    // Two frames: the tab switch renders first, then the field is visible and focusable.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (path) focusField(path);
      }),
    );
  }

  const onSubmit = form.handleSubmit(
    (values) =>
      save.mutate(
        { id: row?.id ?? null, values: toPayload(values) },
        {
          onSuccess: (saved) => {
            form.reset(toValues(saved));
            if (!row) {
              onCreated?.(saved);
              router.replace(`/admin/projects/${saved.id}${window.location.hash}`);
            }
          },
          onError: (error) => {
            if (applyServerErrors(form, error, { focus: false })) {
              revealErrors(Object.keys(firstErrors(error)));
            }
          },
        },
      ),
    (errors) => revealErrors(flattenErrors(errors as FieldErrors).map((item) => item.path)),
  );

  return (
    <>
      <PageHeader
        title={row ? row.title : "New project"}
        back={{ href: "/admin/projects", label: "Projects" }}
        description={
          row ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant={row.status === "published" ? "default" : "secondary"}>
                {row.status === "published" ? "Published" : "Draft"}
              </Badge>
              <span className="font-mono text-xs">{projectPath(row.slug)}</span>
            </span>
          ) : (
            "Fill in the basics, then save to get a draft you can preview."
          )
        }
        actions={
          <HeaderActions row={row} formId={formId} isPending={save.isPending} control={control} />
        }
      />

      <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormErrorSummary
          control={control}
          labels={PROJECT_FIELD_LABELS}
          onNavigate={(path) => setTab(tabOf(path))}
        />

        <Tabs value={tab} onValueChange={(value) => setTab(value as ProjectTab)}>
          <ProjectTabsList control={control} />

          <TabsContent value="basic" forceMount className="data-[state=inactive]:hidden">
            <BasicTab control={control} row={row} />
          </TabsContent>
          <TabsContent value="story" forceMount className="data-[state=inactive]:hidden">
            <StoryTab control={control} row={row} />
          </TabsContent>
          <TabsContent value="tech" forceMount className="data-[state=inactive]:hidden">
            <TechTab control={control} row={row} />
          </TabsContent>
          <TabsContent value="boss" forceMount className="data-[state=inactive]:hidden">
            <BossTab control={control} row={row} setValue={setValue} />
          </TabsContent>
          <TabsContent value="media" forceMount className="data-[state=inactive]:hidden">
            <MediaTab control={control} row={row} />
          </TabsContent>
          <TabsContent value="links" forceMount className="data-[state=inactive]:hidden">
            <LinksTab control={control} row={row} />
          </TabsContent>
          <TabsContent value="seo" forceMount className="data-[state=inactive]:hidden">
            <SeoTab control={control} row={row} />
          </TabsContent>
        </Tabs>

        <FormActions
          control={control}
          isPending={save.isPending}
          cancelHref="/admin/projects"
          submitLabel={row ? "Save" : "Create project"}
          extra={row ? <PreviewLink slug={row.slug} /> : null}
        />
      </form>
    </>
  );
}

/** Tab triggers with an error dot on every tab that holds an error. */
function ProjectTabsList({ control }: { control: AnyControl<ProjectFormValues> }) {
  const { errors } = useFormState({ control });
  const withErrors = new Set(flattenErrors(errors as FieldErrors).map((item) => tabOf(item.path)));

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <TabsList className="h-auto min-w-full justify-start sm:min-w-0">
        {PROJECT_TABS.map((item) => {
          const hasError = withErrors.has(item.id);
          return (
            <TabsTrigger key={item.id} value={item.id} className="h-7 flex-none px-3">
              {item.label}
              {hasError ? (
                <>
                  <span className="bg-destructive size-1.5 rounded-full" aria-hidden />
                  <span className="sr-only">(has errors)</span>
                </>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}

function PreviewLink({ slug, compact = false }: { slug: string; compact?: boolean }) {
  return (
    <Button asChild variant="outline" size={compact ? "sm" : "default"}>
      <a
        href={previewHref(slug)}
        target="_blank"
        rel="noopener"
        title="Opens the last saved version (drafts too) in a new tab"
      >
        <EyeIcon aria-hidden />
        Preview
        <span className="sr-only">(opens the saved version in a new tab)</span>
      </a>
    </Button>
  );
}

function HeaderActions({
  row,
  formId,
  isPending,
  control,
}: {
  row: AdminProject | null;
  formId: string;
  isPending: boolean;
  control: AnyControl<ProjectFormValues>;
}) {
  const { isDirty } = useFormState({ control });
  return (
    <>
      {row ? (
        <>
          <PreviewLink slug={row.slug} compact />
          {row.status === "published" ? (
            <Button asChild variant="outline" size="sm">
              <a href={projectPath(row.slug)} target="_blank" rel="noopener">
                <ExternalLinkIcon aria-hidden />
                View on site
                <span className="sr-only">(new tab)</span>
              </a>
            </Button>
          ) : null}
          <DeleteProjectButton row={row} />
        </>
      ) : null}
      <Button type="submit" form={formId} size="sm" disabled={isPending}>
        {isPending ? (
          <Loader2Icon className="animate-spin" aria-hidden />
        ) : (
          <SaveIcon aria-hidden />
        )}
        {isPending ? "Saving…" : row ? "Save" : "Create project"}
        {isDirty && !isPending ? <span className="sr-only">(unsaved changes)</span> : null}
      </Button>
    </>
  );
}

function DeleteProjectButton({ row }: { row: AdminProject }) {
  const router = useRouter();
  const remove = useDeleteResource("projects");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden />
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{row.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. The project leaves the site right away; its images and videos
              stay in the Media Library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(row.id, {
                  onSuccess: () => {
                    setOpen(false);
                    router.push("/admin/projects");
                  },
                })
              }
            >
              {remove.isPending ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <Trash2Icon aria-hidden />
              )}
              Delete project
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Keeps a form without unsaved changes in step with the cached row. Cache Components can keep
 * this page mounted (hidden by <Activity>) while the admin works elsewhere, and the row can change
 * meanwhile (a Featured/Status toggle in the list, a refetch after a media edit); saving a stale
 * form would silently undo that. A form with unsaved changes is never touched.
 */
function useFollowSavedRow(form: ProjectFormApi, row: AdminProject | null) {
  const seen = useRef(row);
  useEffect(() => {
    if (row === seen.current) return;
    seen.current = row;
    if (row && !form.formState.isDirty) form.reset(toValues(row));
  }, [form, row]);
}

/** Browser "Leave site?" prompt while the form has unsaved changes. */
function useUnsavedChangesWarning(control: AnyControl<ProjectFormValues>) {
  const { isDirty } = useFormState({ control });
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);
}
