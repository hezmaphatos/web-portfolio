import Link from "next/link";

import { Armory, type InventorySkill } from "@/components/chapters/skills/Armory";
import { BranchToggle } from "@/components/chapters/skills/BranchToggle";
import { NodeTitle } from "@/components/chapters/skills/NodeTitle";
import { seconds } from "@/components/chapters/skills/format";
import { SkillTree } from "@/components/chapters/skills/SkillTree";
import { HintButton } from "@/components/game/HintButton";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Markdown } from "@/components/ui/Markdown";
import { Media } from "@/components/ui/Media";
import { dps, toGameSkill } from "@/lib/battle";
import { cn, label } from "@/lib/utils";
import { SKILL_CATEGORIES } from "@/lib/types";
import type { ProjectSummary, Section, Skill, SkillCategory } from "@/lib/types";

type Props = { skills: Skill[]; projects: ProjectSummary[]; section: Section };

type ProjectRef = { id: number; slug: string; title: string };

/** Branch node colour per category (the tree's only colour coding). */
const BRANCH_COLOR: Record<SkillCategory, string> = {
  backend: "bg-hot",
  frontend: "bg-volt",
  mobile: "bg-lime",
  database: "bg-ink",
  design: "bg-hot",
  ml: "bg-volt",
  game: "bg-lime",
  soft: "bg-paper",
};

const MAX_LEVEL = 5;

/**
 * Without JavaScript nothing can be equipped or fought: the Training Dummy and the controls that
 * need JS are hidden, the loadout simply shows the default four (spec §5: readable without JS).
 */
const NO_JS = `[data-training-dummy],[data-needs-js]{display:none!important}`;

/** "OCR — Internal Document Extraction" → "OCR": the part before the em dash, for small chips. */
function shortTitle(title: string): string {
  return title.split(" — ")[0]?.trim() || title;
}

/**
 * Chapter 4 — SKILL TREE (spec §4.1). A Server Component: every skill, its stats and the projects
 * that use it are in the HTML (= Lite mode, readable without JS). Client islands add the game:
 * - <SkillTree>: the graph ([data-skill-tree], branches [data-branch], nodes [data-skill-card]).
 *   Hover/focus/click a node → it lights up together with the project cards that use the skill
 *   ([data-project-ids] → [data-project-id]); nodes are draggable toys that spring back; the
 *   stage hint. <BranchToggle> makes each category a collapsible card on phones, <NodeTitle> the
 *   node's pin button.
 * - <Armory>: inventory of skill cards, the 4 loadout slots ([data-loadout], [data-slot]) with
 *   drag-to-equip and the Equip menu, and the Training Dummy ([data-training-dummy]).
 */
export function SkillsChapter({ skills, projects, section }: Props) {
  const branches = SKILL_CATEGORIES.filter((category) => category !== "soft")
    .map((category) => ({ category, skills: skills.filter((s) => s.category === category) }))
    .filter((branch) => branch.skills.length > 0);

  const usedIn = new Map<number, ProjectRef[]>();
  for (const project of projects) {
    for (const skill of project.skills) {
      const list = usedIn.get(skill.id) ?? [];
      list.push({ id: project.id, slug: project.slug, title: project.title });
      usedIn.set(skill.id, list);
    }
  }

  // Inventory = every game skill, in tree order (branch by branch).
  const inventory: InventorySkill[] = [];
  for (const branch of branches) {
    for (const skill of branch.skills) {
      const game = toGameSkill(skill);
      if (game) inventory.push({ ...game, category: branch.category });
    }
  }

  return (
    <section
      id="skills"
      aria-labelledby="skills-title"
      className="hk-chapter [--chapter-bg:var(--paper-2)]"
      data-chapter="skills"
    >
      <noscript>
        <style>{NO_JS}</style>
      </noscript>
      <div className="hk-wrap">
        <ChapterHeading
          level={4}
          plain="Skills"
          section={section}
          id="skills-title"
          aside={<HintButton hintKey="skills" text={section.hint} className="mt-[0.35em]" />}
        />
        <Markdown className="-mt-4 mb-12 text-lg md:-mt-6">{section.body}</Markdown>

        <SkillTree hint={section.hint} className="relative isolate z-1">
          <p data-needs-js className="hk-pixel text-ink-2 mb-8 text-[0.7rem] leading-relaxed">
            <span aria-hidden="true">▸ </span>
            <span className="hk-only-fine">Hover or click a skill</span>
            <span className="hk-only-coarse">Tap a skill</span> to light up the projects that use it
          </p>
          <div className="gap-x-8 sm:columns-2 lg:columns-3">
            {branches.map((branch, index) => (
              <div
                key={branch.category}
                data-branch={branch.category}
                className="mb-5 break-inside-avoid sm:mb-12"
              >
                <BranchToggle
                  bodyId={`branch-${branch.category}`}
                  index={index}
                  className="hk-branch-head flex items-center gap-3"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "border-ink block size-5 shrink-0 rotate-45 border-2",
                      BRANCH_COLOR[branch.category],
                    )}
                  />
                  <span className="hk-display hk-condensed text-3xl tracking-[-0.005em] uppercase md:text-4xl">
                    {label(branch.category)}
                  </span>
                  <span className="hk-pixel text-ink-2 text-[0.7rem]">
                    {branch.skills.length} {branch.skills.length === 1 ? "skill" : "skills"}
                  </span>
                </BranchToggle>

                {/* Trunk on the left, a short twig to each card: the tree, drawn with borders. */}
                <ul
                  id={`branch-${branch.category}`}
                  data-branch-body
                  className="border-ink mt-4 ml-[9px] space-y-4 border-l-2 pl-6"
                >
                  {branch.skills.map((skill) => (
                    <li key={skill.id} className="hk-twig relative">
                      <SkillCard skill={skill} projects={usedIn.get(skill.id) ?? []} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SkillTree>

        <Armory skills={inventory} />
      </div>
    </section>
  );
}

function SkillCard({ skill, projects }: { skill: Skill; projects: ProjectRef[] }) {
  // Max-level skills are the signature moves: lime card, bigger shadow, a sticker.
  const mastered = skill.level >= MAX_LEVEL;

  return (
    <div
      data-skill-card
      data-skill-id={skill.id}
      data-skill-name={skill.name}
      data-project-ids={projects.map((p) => p.id).join(" ") || undefined}
      className={cn(
        "hk-node hk-panel-flat relative px-4 pt-3 pb-3.5",
        mastered ? "bg-lime shadow-[var(--shadow)]" : "shadow-[var(--shadow-sm)]",
      )}
    >
      {mastered ? (
        <p
          aria-hidden="true"
          className="hk-sticker hk-pixel bg-hot absolute -top-4 right-3 rotate-3 px-2 py-0.5 text-[0.6rem]"
        >
          Max level
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        {skill.icon ? (
          <Media
            media={skill.icon}
            alt=""
            seed={skill.slug}
            ratio={1}
            thumb
            sizes="40px"
            className="border-ink w-10 shrink-0 border-2"
          />
        ) : null}
        <h4 className="min-w-0 flex-1 text-xl leading-tight font-bold">
          <NodeTitle skillId={skill.id} name={skill.name} />
        </h4>
        <LevelPips level={skill.level} />
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-3">
        {skill.damage !== null && skill.cooldown_ms !== null ? (
          <p className="font-semibold">
            <span aria-hidden="true" className="text-hot">
              ▸{" "}
            </span>
            {skill.attack_name ?? skill.name}
          </p>
        ) : (
          <p className="text-ink-2 text-sm">No attack yet</p>
        )}
        <p className="hk-pixel text-ink-2 shrink-0 text-[0.6rem]">
          {skill.status === "learning" ? "Learning" : "Core"}
        </p>
      </div>

      {skill.description ? <p className="mt-2 text-sm">{skill.description}</p> : null}

      {skill.damage !== null && skill.cooldown_ms !== null ? (
        <SkillStats damage={skill.damage} cooldownMs={skill.cooldown_ms} />
      ) : null}

      {projects.length > 0 ? (
        // Above the stretched node button (z-index), so the links stay clickable.
        <div data-used-in className="relative z-2 mt-3 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-ink-2 mr-0.5">Used in</span>
          <ul className="contents">
            {projects.map((project) => (
              <li key={project.id} className="contents">
                <Link
                  href={`/projects/${project.slug}`}
                  className="hk-chip hover:bg-ink hover:text-paper min-h-0 px-2 py-0.5 text-xs"
                >
                  {shortTitle(project.title)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** "70 DMG · 4.0 s CD · 17.5 DPS" as a three-cell readout. DPS = damage ÷ cooldown in s, 1 decimal. */
function SkillStats({ damage, cooldownMs }: { damage: number; cooldownMs: number }) {
  const cells = [
    { short: "DMG", long: "Damage", value: String(damage) },
    { short: "CD", long: "Cooldown", value: seconds(cooldownMs) },
    {
      short: "DPS",
      long: "Damage per second",
      value: dps({ damage, cooldown_ms: cooldownMs }).toFixed(1),
    },
  ];
  return (
    <dl className="border-ink divide-ink mt-2.5 flex divide-x-2 border-2">
      {cells.map((cell) => (
        <div
          key={cell.short}
          className="flex flex-1 flex-row-reverse items-baseline justify-end gap-1.5 px-2 py-1"
        >
          <dt className="hk-pixel text-[0.6rem]">
            <span aria-hidden="true">{cell.short}</span>
            <span className="sr-only">{cell.long}</span>
          </dt>
          <dd className="hk-mono text-[0.9375rem] font-bold">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function LevelPips({ level }: { level: number }) {
  const filled = Math.max(0, Math.min(MAX_LEVEL, level));
  return (
    <span role="img" aria-label={`Level ${filled} of ${MAX_LEVEL}`} className="flex shrink-0 gap-1">
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span
          key={i}
          className={cn("border-ink block size-2.5 border-2", i < filled ? "bg-ink" : "bg-paper")}
        />
      ))}
    </span>
  );
}
