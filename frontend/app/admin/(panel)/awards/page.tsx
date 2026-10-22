import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { AwardsTable } from "@/components/admin/awards/AwardsTable";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/admin/ui/button";

export default function AwardsPage() {
  return (
    <>
      <PageHeader
        title="Awards"
        description="Trophies for the Trophy Room. Use Reorder to set the order they appear in."
        actions={
          <Button asChild>
            <Link href="/admin/awards/new">
              <PlusIcon aria-hidden />
              Add award
            </Link>
          </Button>
        }
      />
      <AwardsTable />
    </>
  );
}
