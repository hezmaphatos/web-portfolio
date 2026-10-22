import { Suspense } from "react";

import {
  AwardEditor,
  AwardEditorLoading,
  AwardNotFound,
} from "@/components/admin/awards/AwardEditor";

/** `params` is request-time data (no generateStaticParams), so it is read inside Suspense. */
export default function EditAwardPage({ params }: PageProps<"/admin/awards/[id]">) {
  return (
    <Suspense fallback={<AwardEditorLoading />}>
      {params.then(({ id }) =>
        /^[1-9]\d{0,9}$/.test(id) ? <AwardEditor id={Number(id)} /> : <AwardNotFound />,
      )}
    </Suspense>
  );
}
