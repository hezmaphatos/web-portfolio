import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { PageHeader } from "@/components/admin/shell/PageHeader";
import { SkillsTable } from "@/components/admin/skills/SkillsTable";
import { Button } from "@/components/admin/ui/button";

export default function SkillsPage() {
  return (
    <>
      <PageHeader
        title="Skills"
        description="Tech for the Skill Tree and the boss battles. Soft skills only appear as chips in About. DPS should stay between 15 and 30."
        actions={
          <Button asChild>
            <Link href="/admin/skills/new">
              <PlusIcon aria-hidden />
              Add skill
            </Link>
          </Button>
        }
      />
      <SkillsTable />
    </>
  );
}
