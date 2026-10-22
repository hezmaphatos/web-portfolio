import { PageHeader } from "@/components/admin/shell/PageHeader";
import { SkillForm } from "@/components/admin/skills/SkillForm";

export default function NewSkillPage() {
  return (
    <>
      <PageHeader
        title="New skill"
        back={{ href: "/admin/skills", label: "Skills" }}
        description="Game skills need an attack name, damage and cooldown; soft skills don't."
      />
      <SkillForm key="new" row={null} />
    </>
  );
}
