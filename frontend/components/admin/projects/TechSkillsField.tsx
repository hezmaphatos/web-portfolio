"use client";

import { useId, useMemo, useState } from "react";
import {
  get,
  useController,
  useFormState,
  useWatch,
  type FieldError as RhfFieldError,
} from "react-hook-form";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/admin/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/admin/ui/popover";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { FieldError, type AnyControl } from "@/components/admin/form";
import { KitError } from "@/components/admin/table";
import { SortableItem, SortableList } from "@/components/admin/projects/SortableList";
import type { ProjectFormValues } from "@/components/admin/projects/project-form";
import { useAllSkills, useTechVisiblePercent } from "@/components/admin/projects/project-queries";
import { splitTech } from "@/lib/battle";
import { SKILL_CATEGORIES, type AdminSkill, type SkillCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type TechSkillsFieldProps = {
  control: AnyControl<ProjectFormValues>;
};

type Lock = "visible" | "locked" | "hidden";

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  backend: "Backend",
  frontend: "Frontend",
  mobile: "Mobile",
  database: "Database",
  design: "Design",
  ml: "Machine learning",
  game: "Game",
  soft: "Soft skills",
};

const EMPTY_SKILLS: AdminSkill[] = [];

function messageOf(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const error = node as RhfFieldError & { root?: RhfFieldError };
  return error.message || error.root?.message || undefined;
}

function gameInfo(skill: AdminSkill): string {
  if (skill.category === "soft" || skill.damage === null || skill.cooldown_ms === null) {
    return "No battle stats";
  }
  return `${skill.damage} dmg · ${(skill.cooldown_ms / 1000).toFixed(1)} s`;
}

/**
 * `skill_ids[]` editor (spec §7 Tech tab): pick game and soft skills, drag (or move) them into
 * reveal order, and see live which chips are visible from the start and which stay locked until
 * the boss is defeated (`splitTech` with the site's `tech_visible_percent`).
 */
export function TechSkillsField({ control }: TechSkillsFieldProps) {
  const {
    field: { value, onChange, onBlur, ref },
  } = useController({ control, name: "skill_ids" });
  const { errors } = useFormState({ control, name: "skill_ids" });
  const bossEnabled = useWatch({ control, name: "boss_enabled" });
  const skills = useAllSkills();
  const tech = useTechVisiblePercent();
  const [open, setOpen] = useState(false);
  const listId = useId();

  const ids: number[] = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const all = skills.data ?? EMPTY_SKILLS;
  const byId = useMemo(() => new Map(all.map((skill) => [skill.id, skill])), [all]);

  /** Hidden skills are left out of the public payload, so they never count as chips. */
  const lockOf = useMemo(() => {
    const onSite = ids.filter((id) => byId.get(id)?.is_visible);
    const { visible } = bossEnabled ? splitTech(onSite, tech.percent) : { visible: onSite };
    const open = new Set(visible);
    return (id: number): Lock =>
      !byId.get(id)?.is_visible ? "hidden" : open.has(id) ? "visible" : "locked";
  }, [ids, byId, bossEnabled, tech.percent]);

  const counts = ids.reduce(
    (acc, id) => {
      acc[lockOf(id)] += 1;
      return acc;
    },
    { visible: 0, locked: 0, hidden: 0 } as Record<Lock, number>,
  );

  const grouped = useMemo(
    () =>
      SKILL_CATEGORIES.map((category) => ({
        category,
        skills: all.filter((skill) => skill.category === category),
      })).filter((group) => group.skills.length > 0),
    [all],
  );

  const rootError = messageOf(get(errors, "skill_ids"));
  const nameOf = (id: number) => byId.get(id)?.name ?? `Skill #${id}`;

  function update(next: number[]) {
    onChange(next);
    onBlur();
  }

  function toggle(id: number) {
    update(ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update(next);
  }

  function focusLater(elementId: string) {
    requestAnimationFrame(() => document.getElementById(elementId)?.focus());
  }

  return (
    <div className="flex flex-col gap-4" data-field="skill_ids">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {ids.length === 0 ? (
            "No skills selected yet."
          ) : skills.isPending || tech.isPending ? (
            "Loading skills…"
          ) : !bossEnabled ? (
            <>
              {ids.length} {ids.length === 1 ? "skill" : "skills"}. The boss is off, so every chip
              is visible from the start.
            </>
          ) : (
            <>
              <strong className="text-foreground">{counts.visible}</strong> visible from the start ·{" "}
              <strong className="text-foreground">{counts.locked}</strong> locked until the boss is
              defeated{counts.hidden ? ` · ${counts.hidden} hidden` : ""}. Game settings show{" "}
              {tech.percent} % of the chips
              {tech.isError ? " (default: the site settings could not be loaded)" : ""}.
            </>
          )}
        </p>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant="outline"
              size="sm"
              disabled={skills.isPending || skills.isError}
              aria-invalid={rootError ? true : undefined}
            >
              <PlusIcon aria-hidden />
              Add skills
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <Command>
              <CommandInput placeholder="Search skills…" aria-label="Search skills" />
              <CommandList className="max-h-80">
                <CommandEmpty>No skill matches.</CommandEmpty>
                {grouped.map((group) => (
                  <CommandGroup key={group.category} heading={CATEGORY_LABEL[group.category]}>
                    {group.skills.map((skill) => {
                      const selected = ids.includes(skill.id);
                      return (
                        <CommandItem
                          key={skill.id}
                          value={`${skill.name} ${skill.slug} ${group.category}`}
                          onSelect={() => toggle(skill.id)}
                          data-checked={selected ? "true" : undefined}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {skill.name}
                            <span className="sr-only">{selected ? " (selected)" : ""}</span>
                          </span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {skill.category === "soft" ? "soft" : gameInfo(skill)}
                          </span>
                          {!skill.is_visible ? (
                            <EyeOffIcon
                              className="text-muted-foreground size-3.5"
                              aria-label="Hidden"
                            />
                          ) : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {skills.isPending ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Loading skills">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : skills.isError ? (
        <KitError
          error={skills.error}
          onRetry={() => void skills.refetch()}
          title="Could not load skills"
        />
      ) : ids.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          Add the skills used in this project. The first ones in the list are shown on the site from
          the start; the rest stay locked (“???”) until the visitor beats the boss.
        </div>
      ) : (
        <>
          <ChipPreview ids={ids} nameOf={nameOf} lockOf={lockOf} />
          <SortableList ids={ids.map(String)} onMove={move} labelOf={(id) => nameOf(Number(id))}>
            <ol
              id={listId}
              className="flex flex-col gap-1.5"
              aria-label="Selected skills, in reveal order"
            >
              {ids.map((id, index) => {
                const skill = byId.get(id);
                const lock = lockOf(id);
                const itemError = messageOf(get(errors, `skill_ids.${index}`));
                return (
                  <SortableItem
                    key={id}
                    id={String(id)}
                    label={nameOf(id)}
                    className={cn(
                      "bg-card rounded-lg border border-l-4",
                      lock === "visible" && "border-l-emerald-500",
                      lock === "locked" && "border-l-amber-500",
                      lock === "hidden" && "border-l-muted-foreground/40 border-dashed",
                      itemError && "border-destructive",
                    )}
                  >
                    {({ handle }) => (
                      <div
                        className="flex flex-col gap-1 px-2 py-1.5"
                        data-field={`skill_ids.${index}`}
                      >
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {handle}
                          <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">
                            {index + 1}.
                          </span>
                          <span className="min-w-0 font-medium">{nameOf(id)}</span>
                          {skill ? (
                            <Badge variant="outline" className="font-normal">
                              {CATEGORY_LABEL[skill.category]}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Unknown skill</Badge>
                          )}
                          {skill ? (
                            <span className="text-muted-foreground text-xs tabular-nums">
                              {gameInfo(skill)}
                            </span>
                          ) : null}
                          <LockLabel lock={lock} bossEnabled={bossEnabled} />
                          <div className="ml-auto flex items-center gap-0.5">
                            <Button
                              id={`${listId}-up-${id}`}
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={index === 0}
                              onClick={() => {
                                move(index, index - 1);
                                focusLater(`${listId}-up-${id}`);
                              }}
                              aria-label={`Move ${nameOf(id)} up`}
                            >
                              <ChevronUpIcon aria-hidden />
                            </Button>
                            <Button
                              id={`${listId}-down-${id}`}
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={index === ids.length - 1}
                              onClick={() => {
                                move(index, index + 1);
                                focusLater(`${listId}-down-${id}`);
                              }}
                              aria-label={`Move ${nameOf(id)} down`}
                            >
                              <ChevronDownIcon aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => toggle(id)}
                              aria-label={`Remove ${nameOf(id)}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <XIcon aria-hidden />
                            </Button>
                          </div>
                        </div>
                        <FieldError message={itemError} />
                      </div>
                    )}
                  </SortableItem>
                );
              })}
            </ol>
          </SortableList>
        </>
      )}
      <FieldError message={rootError} />
    </div>
  );
}

function LockLabel({ lock, bossEnabled }: { lock: Lock; bossEnabled: boolean }) {
  if (lock === "hidden") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <EyeOffIcon className="size-3.5" aria-hidden />
        Hidden skill: not shown on the site
      </span>
    );
  }
  if (lock === "visible" || !bossEnabled) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <EyeIcon className="size-3.5" aria-hidden />
        Visible from the start
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-800">
      <LockIcon className="size-3.5" aria-hidden />
      Locked until the boss is defeated
    </span>
  );
}

/** How the chips read on the site before the boss is beaten. */
function ChipPreview({
  ids,
  nameOf,
  lockOf,
}: {
  ids: readonly number[];
  nameOf: (id: number) => string;
  lockOf: (id: number) => Lock;
}) {
  const chips = ids.filter((id) => lockOf(id) !== "hidden");
  if (chips.length === 0) return null;
  return (
    <div className="bg-muted/40 flex flex-col gap-2 rounded-lg border px-3 py-2.5">
      <p className="text-muted-foreground text-xs font-medium">On the site, before the fight</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Chip preview">
        {chips.map((id) =>
          lockOf(id) === "visible" ? (
            <li
              key={id}
              className="rounded-sm border-2 border-[#111111] bg-white px-2 py-0.5 text-xs font-medium"
            >
              {nameOf(id)}
            </li>
          ) : (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-sm border-2 border-dashed border-[#111111]/60 bg-white/60 px-2 py-0.5 font-mono text-xs"
            >
              <LockIcon className="size-3" aria-hidden />
              ???
              <span className="sr-only">(locked: {nameOf(id)})</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
