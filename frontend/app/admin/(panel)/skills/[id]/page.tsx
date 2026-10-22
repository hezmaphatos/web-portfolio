import { Suspense } from "react";

import { LoadingState } from "@/components/admin/shell/LoadingState";
import { SkillEditor } from "@/components/admin/skills/SkillEditor";

/** `params` is request-time data (no generateStaticParams), so it is read inside Suspense. */
export default function EditSkillPage({ params }: PageProps<"/admin/skills/[id]">) {
  return (
    <Suspense fallback={<LoadingState variant="form" rows={6} label="Loading skill…" />}>
      {params.then(({ id }) => (
        <SkillEditor id={id} />
      ))}
    </Suspense>
  );
}
