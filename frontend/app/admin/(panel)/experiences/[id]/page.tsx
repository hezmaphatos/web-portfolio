import { Suspense } from "react";

import {
  ExperienceEditor,
  ExperienceEditorLoading,
  ExperienceNotFound,
} from "@/components/admin/experiences/ExperienceEditor";

/** `params` is request-time data (no generateStaticParams), so it is read inside Suspense. */
export default function EditExperiencePage({ params }: PageProps<"/admin/experiences/[id]">) {
  return (
    <Suspense fallback={<ExperienceEditorLoading />}>
      {params.then(({ id }) =>
        /^[1-9]\d{0,9}$/.test(id) ? <ExperienceEditor id={Number(id)} /> : <ExperienceNotFound />,
      )}
    </Suspense>
  );
}
