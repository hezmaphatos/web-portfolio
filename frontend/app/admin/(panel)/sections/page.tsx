import { SectionsTable } from "@/components/admin/sections/SectionsTable";
import { PageHeader } from "@/components/admin/shell/PageHeader";

export default function SectionsPage() {
  return (
    <>
      <PageHeader
        title="Sections"
        description="The eight home-page chapters, in their fixed order. Edit their titles, intro text and stage hints, or hide a chapter. Chapters cannot be added, removed or reordered."
      />
      <SectionsTable />
    </>
  );
}
