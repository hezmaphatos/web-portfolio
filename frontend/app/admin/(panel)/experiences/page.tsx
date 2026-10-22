import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { ExperiencesTable } from "@/components/admin/experiences/ExperiencesTable";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/admin/ui/button";

export default function ExperiencesPage() {
  return (
    <>
      <PageHeader
        title="Experiences"
        description="Jobs, internships, organizations and schools on the Quest Log. Use Reorder to set the order they appear in."
        actions={
          <Button asChild>
            <Link href="/admin/experiences/new">
              <PlusIcon aria-hidden />
              Add experience
            </Link>
          </Button>
        }
      />
      <ExperiencesTable />
    </>
  );
}
