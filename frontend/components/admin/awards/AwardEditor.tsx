"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchXIcon } from "lucide-react";

import { AwardForm } from "@/components/admin/awards/AwardForm";
import { PLACEMENT_LABEL } from "@/components/admin/awards/PlacementBadge";
import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { RowActions } from "@/components/admin/table";
import { Button } from "@/components/admin/ui/button";
import { ApiError } from "@/lib/admin/api";
import { useResourceItem } from "@/lib/admin/resource";
import type { AdminAward } from "@/lib/types";

const LIST_HREF = "/admin/awards";
const BACK = { href: LIST_HREF, label: "Awards" };

/** /admin/awards/new (id = null) and /admin/awards/[id]. */
export function AwardEditor({ id }: { id: number | null }) {
  const router = useRouter();
  const item = useResourceItem<AdminAward>("awards", id);

  if (id === null) {
    return (
      <>
        <PageHeader
          title="New award"
          description="A medal, finalist spot or participation for the Trophy Room."
          back={BACK}
        />
        <AwardForm key="new" row={null} />
      </>
    );
  }

  if (item.isPending) return <AwardEditorLoading />;

  if (item.isError) {
    if (item.error instanceof ApiError && item.error.status === 404) return <AwardNotFound />;
    return (
      <>
        <PageHeader title="Edit award" back={BACK} />
        <ErrorState
          title="Couldn't load this award"
          error={item.error}
          onRetry={() => void item.refetch()}
          retrying={item.isFetching}
        />
      </>
    );
  }

  const row = item.data;
  const meta = [row.event, row.year, PLACEMENT_LABEL[row.placement]].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        title={row.title}
        description={meta}
        back={BACK}
        actions={
          <RowActions
            resource="awards"
            id={row.id}
            label={row.title}
            onDelete={() => router.replace(LIST_HREF)}
          />
        }
      />
      <AwardForm key={row.id} row={row} />
    </>
  );
}

/** Unknown or malformed id. */
export function AwardNotFound() {
  return (
    <>
      <PageHeader title="Award not found" back={BACK} />
      <EmptyState
        icon={SearchXIcon}
        title="This award doesn't exist"
        description="It may have been deleted. Pick one from the list instead."
        action={
          <Button asChild variant="outline">
            <Link href={LIST_HREF}>Back to awards</Link>
          </Button>
        }
      />
    </>
  );
}

/** Header + form skeleton, also the Suspense fallback while the route param resolves. */
export function AwardEditorLoading() {
  return (
    <>
      <PageHeader title="Edit award" back={BACK} />
      <LoadingState variant="form" rows={7} label="Loading the award…" />
    </>
  );
}
