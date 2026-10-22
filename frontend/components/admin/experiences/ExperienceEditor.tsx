"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchXIcon } from "lucide-react";

import { ExperienceForm } from "@/components/admin/experiences/ExperienceForm";
import {
  EXPERIENCE_TYPE_LABEL,
  formatPeriod,
} from "@/components/admin/experiences/experience-schema";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { RowActions } from "@/components/admin/table";
import { Button } from "@/components/admin/ui/button";
import { ApiError } from "@/lib/admin/api";
import { useResourceItem } from "@/lib/admin/resource";
import type { AdminExperience } from "@/lib/types";

const LIST_HREF = "/admin/experiences";
const BACK = { href: LIST_HREF, label: "Experiences" };

/** /admin/experiences/new (id = null) and /admin/experiences/[id]. */
export function ExperienceEditor({ id }: { id: number | null }) {
  const router = useRouter();
  const item = useResourceItem<AdminExperience>("experiences", id);

  if (id === null) {
    return (
      <>
        <PageHeader
          title="New experience"
          description="A job, internship, organization or school for the Quest Log."
          back={BACK}
        />
        <ExperienceForm key="new" row={null} />
      </>
    );
  }

  if (item.isPending) return <ExperienceEditorLoading />;

  if (item.isError) {
    if (item.error instanceof ApiError && item.error.status === 404) {
      return <ExperienceNotFound />;
    }
    return (
      <>
        <PageHeader title="Edit experience" back={BACK} />
        <ErrorState
          title="Couldn't load this experience"
          error={item.error}
          onRetry={() => void item.refetch()}
          retrying={item.isFetching}
        />
      </>
    );
  }

  const row = item.data;

  return (
    <>
      <PageHeader
        title={row.title}
        description={`${EXPERIENCE_TYPE_LABEL[row.type]} · ${row.organization} · ${formatPeriod(row.start_date, row.end_date)}`}
        back={BACK}
        actions={
          <RowActions
            resource="experiences"
            id={row.id}
            label={row.title}
            onDelete={() => router.replace(LIST_HREF)}
          />
        }
      />
      <ExperienceForm key={row.id} row={row} />
    </>
  );
}

/** Unknown or malformed id. */
export function ExperienceNotFound() {
  return (
    <>
      <PageHeader title="Experience not found" back={BACK} />
      <EmptyState
        icon={SearchXIcon}
        title="This experience doesn't exist"
        description="It may have been deleted. Pick one from the list instead."
        action={
          <Button asChild variant="outline">
            <Link href={LIST_HREF}>Back to experiences</Link>
          </Button>
        }
      />
    </>
  );
}

/** Header + form skeleton, also the Suspense fallback while the route param resolves. */
export function ExperienceEditorLoading() {
  return (
    <>
      <PageHeader title="Edit experience" back={BACK} />
      <LoadingState variant="form" rows={8} label="Loading the experience…" />
    </>
  );
}
