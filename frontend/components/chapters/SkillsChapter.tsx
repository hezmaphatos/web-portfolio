import Link from "next/link";

import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Markdown } from "@/components/ui/Markdown";
import { Media } from "@/components/ui/Media";
import {
  LOADOUT_SIZE,
  TRAINING_DUMMY_HP,
  clearTime,
  defaultLoadout,
  dps,
  formatClearTime,
  type GameSkill,
} from "@/lib/battle";
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

/** "4000" → "4.0 s". */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** "OCR — Internal Document Extraction" → "OCR": the part before the em dash, for small chips. */
function shortTitle(title: string): string {
  return title.split(" — ")[0]?.trim() || title;
}

/**
 * Chapter 4 — SKILL TREE (spec §4.1). Static version (= Lite mode): the tree is the skills grouped
 * by category, every card shows its game stats and the projects that use it, and the loadout panel
 * shows the default loadout. Phase 5 builds the interaction on these hooks:
 * - [data-skill-tree] the tree; [data-branch] a category; [data-skill-card] a skill node
 *   (draggable, highlights the projects in [data-project-ids]);
 * - [data-loadout] the panel, [data-slot] its four slots (drop targets, keys 1–4);
 * - [data-training-dummy] where the dummy mounts.
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

  const loadout = defaultLoadout(skills);

  return (
    <section
      id="skills"
      aria-labelledby="skills-title"
      className="hk-chapter [--chapter-bg:var(--paper-2)]"
      data-chapter="skills"
    >
      <div className="hk-wrap">
        <ChapterHeading level={4} plain="Skills" section={section} id="skills-title" />
        <Markdown className="-mt-4 mb-12 text-lg md:-mt-6">{section.body}</Markdown>

        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1">
            <LoadoutPanel loadout={loadout} />
          </div>

          <div data-skill-tree className="lg:col-span-8 lg:row-start-1">
            <div className="gap-x-8 sm:columns-2">
              {branches.map((branch) => (
                <div
                  key={branch.category}
                  data-branch={branch.category}
                  className="mb-12 break-inside-avoid"
                >
                  <h3 className="flex items-center gap-3">
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
                  </h3>

                  {/* Trunk on the left, a short twig to each card: the tree, drawn with borders. */}
                  <ul className="border-ink mt-4 ml-[9px] space-y-4 border-l-2 pl-6">
                    {branch.skills.map((skill) => (
                      <li
                        key={skill.id}
                        className="before:bg-ink relative before:absolute before:top-7 before:-left-6 before:h-0.5 before:w-6"
                      >
                        <SkillCard skill={skill} projects={usedIn.get(skill.id) ?? []} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
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
      data-project-ids={projects.map((p) => p.id).join(" ") || undefined}
      className={cn(
        "hk-panel-flat relative px-4 pt-3 pb-3.5",
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
        <h4 className="min-w-0 flex-1 text-xl leading-tight font-bold">{skill.name}</h4>
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
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

/** The four loadout slots with the default loadout (the interactive inventory is phase 5). */
function LoadoutPanel({ loadout }: { loadout: GameSkill[] }) {
  const slots = Array.from({ length: LOADOUT_SIZE }, (_, i) => loadout[i] ?? null);
  const volley = loadout.reduce((sum, skill) => sum + skill.damage, 0);
  const clear = clearTime(loadout, TRAINING_DUMMY_HP);

  return (
    <div
      data-loadout
      className="hk-panel bg-ink text-paper relative p-5 shadow-[6px_6px_0_var(--hot)] md:p-6 lg:sticky lg:top-24"
    >
      <p
        aria-hidden="true"
        className="hk-sticker hk-pixel absolute -top-4 right-4 rotate-3 text-[0.65rem]"
      >
        Default
      </p>
      <h3 className="hk-display hk-condensed text-4xl tracking-[-0.005em] uppercase">Loadout</h3>
      <p className="mt-2 text-sm leading-relaxed opacity-90">
        Four equipped skills fight every boss. Each slot charges for its cooldown, then hits for its
        damage. Until you pick your own, the four hardest hitters are equipped.
      </p>

      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {slots.map((skill, i) => (
          <li
            key={skill?.id ?? `empty-${i}`}
            data-slot={i}
            className={cn(
              "flex min-h-[4.5rem] items-start gap-3 border-2 p-3",
              skill ? "bg-paper text-ink border-paper" : "border-paper/60 border-dashed",
            )}
          >
            <span
              aria-hidden="true"
              className="hk-pixel border-ink bg-lime text-ink grid size-7 shrink-0 place-items-center border-2 text-xs"
            >
              {i + 1}
            </span>
            {skill ? (
              <span className="min-w-0">
                <span className="sr-only">Slot {i + 1}: </span>
                <span className="block leading-tight font-bold">{skill.attack_name}</span>
                <span className="hk-mono text-ink-2 mt-0.5 block text-xs">
                  {skill.name} · {skill.damage} DMG · {seconds(skill.cooldown_ms)}
                </span>
              </span>
            ) : (
              <span className="text-sm opacity-80">
                <span className="sr-only">Slot {i + 1}: </span>Empty slot
              </span>
            )}
          </li>
        ))}
      </ol>

      {loadout.length > 0 ? (
        <dl className="hk-mono border-paper/30 mt-5 grid grid-cols-2 gap-3 border-t-2 pt-4 text-sm">
          <div>
            <dt className="hk-pixel text-[0.6rem] opacity-80">Damage per volley</dt>
            <dd className="text-lime text-2xl font-bold">{volley}</dd>
          </div>
          <div>
            <dt className="hk-pixel text-[0.6rem] opacity-80">
              Dummy clear time<span className="sr-only"> ({TRAINING_DUMMY_HP} HP)</span>
            </dt>
            <dd className="text-lime text-2xl font-bold">{formatClearTime(clear)}</dd>
          </div>
        </dl>
      ) : null}

      <p className="hk-pixel border-paper/30 mt-5 border-t-2 pt-4 text-[0.65rem] leading-relaxed">
        <span aria-hidden="true">⇢ </span>Drag skills here to change your loadout
      </p>

      {/* Phase 5: the Training Dummy (HP 100) mounts here. */}
      <div data-training-dummy />
    </div>
  );
}
