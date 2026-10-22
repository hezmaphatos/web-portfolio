"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { FolderSearchIcon } from "lucide-react";

import { Button } from "@/components/admin/ui/button";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { ProjectForm } from "@/components/admin/projects/ProjectForm";
import { ApiError } from "@/lib/admin/api";
import { useResourceItem } from "@/lib/admin/resource";
import type { AdminProject } from "@/lib/types";

const BACK = { href: "/admin/projects", label: "Projects" };

function NotFound() {
  return (
    <>
      <PageHeader title="Project not found" back={BACK} />
      <EmptyState
        icon={FolderSearchIcon}
        title="This project does not exist"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/projects">Back to projects</Link>
          </Button>
        }
      />
    </>
  );
}

/**
 * `/admin/projects/new`. Cache Components keep this route mounted (hidden by <Activity>) after
 * the redirect to the created project, so the filled-in form would come back on the next
 * "Add project". Once a create succeeded, the form is remounted blank as the route is hidden
 * (not before, so the page does not flash empty during the redirect). An unsaved draft is kept.
 */
function NewProjectForm() {
  const [generation, setGeneration] = useState(0);
  const created = useRef(false);

  useLayoutEffect(
    () => () => {
      if (!created.current) return;
      created.current = false;
      setGeneration((n) => n + 1);
    },
    [],
  );

  return (
    <ProjectForm
      key={`new-${generation}`}
      row={null}
      onCreated={() => {
        created.current = true;
      }}
    />
  );
}

/** `/admin/projects/new` (id null) or `/admin/projects/{id}`: loading / error / form. */
export function ProjectEditor({ id }: { id: number | null }) {
  const valid = id !== null && Number.isInteger(id) && id > 0;
  const item = useResourceItem<AdminProject>("projects", valid ? id : null);

  if (id === null) return <NewProjectForm />;
  if (!valid) return <NotFound />;

  if (item.isPending) {
    return (
      <>
        <PageHeader title="Edit project" back={BACK} />
        <LoadingState variant="form" rows={6} label="Loading project…" />
      </>
    );
  }

  if (item.isError) {
    if (item.error instanceof ApiError && item.error.status === 404) return <NotFound />;
    return (
      <>
        <PageHeader title="Edit project" back={BACK} />
        <ErrorState
          error={item.error}
          onRetry={() => void item.refetch()}
          retrying={item.isFetching}
        />
      </>
    );
  }

  return <ProjectForm key={item.data.id} row={item.data} />;
}
