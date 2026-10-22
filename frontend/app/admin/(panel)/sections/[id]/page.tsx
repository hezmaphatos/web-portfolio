import { Suspense } from "react";

import { SectionEditor } from "@/components/admin/sections/SectionEditor";
import { LoadingState } from "@/components/admin/shell/LoadingState";

/**
 * The id is runtime data (no generateStaticParams), so it is read inside Suspense
 * (Cache Components); the editor loads and saves the row in the browser.
 */
export default function SectionEditPage({ params }: PageProps<"/admin/sections/[id]">) {
  return (
    <Suspense fallback={<LoadingState variant="form" rows={4} label="Loading section…" />}>
      {params.then(({ id }) => (
        <SectionEditor rawId={id} />
      ))}
    </Suspense>
  );
}
