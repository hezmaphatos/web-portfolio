import { SiteEditor } from "@/components/admin/site/SiteEditor";
import { PageHeader } from "@/components/admin/shell/PageHeader";

export default function SitePage() {
  return (
    <>
      <PageHeader
        title="Profile & Site"
        description="Your profile, contact details, stats, files, SEO defaults and game settings. One record, used across the whole site."
      />
      <SiteEditor />
    </>
  );
}
