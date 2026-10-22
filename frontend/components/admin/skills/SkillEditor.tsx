"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchXIcon } from "lucide-react";

import { EmptyState } from "@/components/admin/shell/EmptyState";
import { ErrorState } from "@/components/admin/shell/ErrorState";
import { LoadingState } from "@/components/admin/shell/LoadingState";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { SkillForm } from "@/components/admin/skills/SkillForm";
import { CATEGORY_LABEL, SOFT } from "@/components/admin/skills/skill-schema";
import { RowActions } from "@/components/admin/table";
import { Button } from "@/components/admin/ui/button";
import { ApiError } from "@/lib/admin/api";
import { useResourceItem } from "@/lib/admin/resource";
import type { AdminSkill } from "@/lib/types";

const BACK = { href: "/admin/skills", label: "Skills" };

/** Positive integer ids only (same rule as the other editors); anything else is "not found". */
function parseId(raw: string): number | null {
  return /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : null;
}

function NotFound() {
  return (
    <>
      <PageHeader title="Skill not found" back={BACK} />
      <EmptyState
        icon={SearchXIcon}
        title="This skill does not exist"
        description="It may have been deleted."
        action={
          <Button asChild variant="outline">
            <Link href="/admin/skills">Back to skills</Link>
          </Button>
        }
      />
    </>
  );
}

/** Body of /admin/skills/[id]: loads the row, then mounts the form with it. */
export function SkillEditor({ id: rawId }: { id: string }) {
  const id = parseId(rawId);
  if (id === null) return <NotFound />;
  return <LoadedSkillEditor id={id} />;
}

function LoadedSkillEditor({ id }: { id: number }) {
  const router = useRouter();
  const item = useResourceItem<AdminSkill>("skills", id);

  if (item.isPending) {
    return (
      <>
        <PageHeader title="Edit skill" back={BACK} />
        <LoadingState variant="form" rows={6} label="Loading skill…" />
      </>
    );
  }

  if (item.isError) {
    if (item.error instanceof ApiError && item.error.status === 404) return <NotFound />;
    return (
      <>
        <PageHeader title="Edit skill" back={BACK} />
        <ErrorState
          title="Couldn't load this skill"
          error={item.error}
          onRetry={() => void item.refetch()}
          retrying={item.isFetching}
        />
      </>
    );
  }

  const row = item.data;
  const used = row.projects_count;

  return (
    <>
      <PageHeader
        title={row.name}
        back={BACK}
        description={
          <>
            {CATEGORY_LABEL[row.category]}
            {row.category === SOFT ? " · shown as a chip in About" : null} · used in {used}{" "}
            {used === 1 ? "project" : "projects"}
          </>
        }
        actions={
          <RowActions
            resource="skills"
            id={row.id}
            label={row.name}
            onDelete={() => router.replace("/admin/skills")}
            deleteDescription={
              used > 0
                ? `It is removed from ${used} ${used === 1 ? "project" : "projects"}.`
                : undefined
            }
          />
        }
      />
      <SkillForm key={row.id} row={row} />
    </>
  );
}
